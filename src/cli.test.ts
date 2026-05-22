import { expect, test } from 'bun:test';
import { strFromU8, unzipSync } from 'fflate';
import { main } from './cli.ts';
import { createFakeContext } from './testHelpers/index.ts';

test('prints usage and exits 0 when --help is passed', async () => {
  const { ctx, io } = createFakeContext();
  const result = await main(ctx, ['--help']);
  expect(result).toMatchObject({ kind: 'usage', code: 0 });
  expect(io.stderr.text()).toContain('usage: patchwave-analysis');
});

test('prompts for the target when no positional is provided, picking from the listed orgs', async () => {
  const { ctx, prompter, githubClient } = createFakeContext();
  githubClient.onRequest('GET /user').resolves({ login: 'ben' });
  githubClient.onPaginate('GET /user/orgs').resolves([{ login: 'acme' }]);
  prompter.scriptSelect('acme');
  // The chosen org then drives the real run, which fails the listing — we
  // only care that the select fired and that target_prompted is recorded.
  githubClient.onPaginate('GET /orgs/{org}/repos', {}).fails({ kind: 'forbidden', message: 'no access' });

  const result = await main(ctx, []);

  expect(prompter.selects[0]?.choices.map((c) => c.value)).toEqual(['ben', 'acme', '__other__']);
  expect(result.kind).toBe('failed');
});

test('cancelling the target prompt returns failed and tells the user why', async () => {
  const { ctx, prompter, githubClient } = createFakeContext();
  githubClient.onRequest('GET /user').resolves({ login: 'ben' });
  githubClient.onPaginate('GET /user/orgs').resolves([]);
  prompter.scriptSelect({ kind: 'cancelled' });

  const result = await main(ctx, []);

  expect(result).toMatchObject({ kind: 'failed', code: 1 });
  expect(prompter.errors[0]).toContain('cancelled by user');
});

test('rejects an invalid --window value', async () => {
  const { ctx, io } = createFakeContext();
  const result = await main(ctx, ['acme', '--window', 'foobar']);
  expect(result).toMatchObject({ kind: 'usage', code: 1 });
  expect(io.stderr.text()).toContain('invalid --window');
});

test('writes a report when the GitHub calls succeed', async () => {
  const { ctx, githubClient, fs, analytics } = createFakeContext();

  githubClient.onPaginate('GET /orgs/{org}/repos', {}).resolves([
    {
      name: 'widgets',
      owner: { login: 'acme' },
      private: true,
      visibility: 'private',
      archived: false,
      default_branch: 'main',
      language: 'TypeScript',
      pushed_at: '2026-04-01T00:00:00Z',
    },
  ]);
  githubClient.onRequest('GET /repos/{owner}/{repo}/languages', {}).resolves({ TypeScript: 1000 });
  githubClient.onRequest('GET /repos/{owner}/{repo}/contents/{path}', {}).resolves({
    content: Buffer.from('updates:\n  - package-ecosystem: "npm"\n', 'utf8').toString('base64'),
    encoding: 'base64',
  });
  githubClient.onPaginate('GET /repos/{owner}/{repo}/dependabot/alerts', {}).resolves([]);
  githubClient
    .onRequest('GET /repos/{owner}/{repo}/branches/{branch}/protection', {})
    .fails({ kind: 'not-found', message: 'no protection' });
  githubClient.onRequest('GET /repos/{owner}/{repo}/rules/branches/{branch}', {}).resolves([]);
  githubClient.onPaginate('GET /repos/{owner}/{repo}/commits', {}).resolves([]);
  githubClient.onGraphql('DependabotPrs').resolves({
    search: { pageInfo: { hasNextPage: false, endCursor: null }, nodes: [] },
  });

  const result = await main(ctx, ['acme', '--out', '/tmp/report']);
  expect(result.kind).toBe('completed');
  expect(result.code).toBe(0);

  const written = fs.read('/tmp/report.md');
  expect(written).toBeDefined();
  expect(written).toContain('# Dependabot diagnostic — `acme`');

  const zipBytes = fs.readBinary('/tmp/report.zip');
  expect(zipBytes).toBeInstanceOf(Uint8Array);
  const entries = unzipSync(zipBytes as Uint8Array);
  expect(Object.keys(entries).sort()).toEqual(
    [
      'README.txt',
      'data/aggregated.json',
      'data/branch-protection.json',
      'data/contributors.json',
      'data/cve.json',
      'data/dependabot-config.json',
      'data/dependabot-prs.json',
      'data/languages.json',
      'data/meta.json',
      'data/repos.json',
      'data/reverts.json',
      'data/warnings.json',
      'patchwave-report.md',
    ].sort(),
  );
  const meta = JSON.parse(strFromU8(entries['data/meta.json'] as Uint8Array)) as Record<string, unknown>;
  expect(meta).toMatchObject({
    target: 'acme',
    windowDays: 90,
    counts: { reposTotal: 1, reposIncluded: 1, dependabotPrs: 0, warnings: 0 },
  });
  const repos = JSON.parse(strFromU8(entries['data/repos.json'] as Uint8Array)) as Array<{ name: string }>;
  expect(repos).toHaveLength(1);
  expect(repos[0]?.name).toBe('widgets');

  // The completed run hands the bytes + paths back so the caller (index.ts) can
  // drive the share prompt without re-reading the filesystem.
  if (result.kind === 'completed') {
    expect(result.run.target).toBe('acme');
    expect(result.run.paths.markdown).toBe('/tmp/report.md');
    expect(result.run.zipBytes).toBeInstanceOf(Uint8Array);
    expect(result.run.markdown).toContain('# Dependabot diagnostic');
  }

  expect(analytics.capturedEvents('run_started')[0]?.properties).toMatchObject({
    window_days: 90,
    has_include: false,
    has_exclude: false,
    target_prompted: false,
  });
  const completed = analytics.capturedEvents('run_completed')[0];
  expect(completed?.properties).toMatchObject({
    window_days: 90,
    repos_total: 1,
    repos_included: 1,
    dependabot_prs: 0,
    warnings: 0,
  });
  // org/repo names must never appear in telemetry payloads
  expect(JSON.stringify(analytics.captureCalls)).not.toContain('acme');
  expect(JSON.stringify(analytics.captureCalls)).not.toContain('widgets');
});

test('captures run_failed when listOrgRepos fails', async () => {
  const { ctx, githubClient, analytics } = createFakeContext();
  githubClient.onPaginate('GET /orgs/{org}/repos', {}).fails({ kind: 'forbidden', message: 'no access' });

  await main(ctx, ['acme']);

  const failed = analytics.capturedEvents('run_failed')[0];
  expect(failed?.properties).toMatchObject({ error_kind: 'forbidden' });
});

test('exits 1 when listOrgRepos fails non-recoverably', async () => {
  const { ctx, prompter, githubClient } = createFakeContext();
  githubClient.onPaginate('GET /orgs/{org}/repos', {}).fails({ kind: 'forbidden', message: 'no access' });

  const result = await main(ctx, ['acme']);
  expect(result).toMatchObject({ kind: 'failed', code: 1 });
  expect(prompter.errors[0]).toContain('403');
});
