import { expect, test } from 'bun:test';
import { main } from './cli.ts';
import { createFakeContext } from './testHelpers/index.ts';

test('prints usage and exits 0 when --help is passed', async () => {
  const { ctx, io } = createFakeContext();
  const code = await main(ctx, ['--help']);
  expect(code).toBe(0);
  expect(io.stderr.text()).toContain('usage: patchwave-analysis');
});

test('returns 1 and prints the usage when no target is provided', async () => {
  const { ctx, io } = createFakeContext();
  const code = await main(ctx, []);
  expect(code).toBe(1);
  expect(io.stderr.text()).toContain('missing required argument');
});

test('rejects an invalid --window value', async () => {
  const { ctx, io } = createFakeContext();
  const code = await main(ctx, ['acme', '--window', 'foobar']);
  expect(code).toBe(1);
  expect(io.stderr.text()).toContain('invalid --window');
});

test('writes a report when the GitHub calls succeed', async () => {
  const { ctx, io, githubClient, fs, analytics } = createFakeContext();

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
  githubClient.onPaginate('GET /repos/{owner}/{repo}/commits', {}).resolves([]);
  githubClient.onGraphql('DependabotPrs').resolves({
    search: { pageInfo: { hasNextPage: false, endCursor: null }, nodes: [] },
  });

  const code = await main(ctx, ['acme', '--out', '/tmp/report.md']);
  expect(code).toBe(0);
  expect(io.stdout.text()).toContain('wrote /tmp/report.md');

  const written = fs.read('/tmp/report.md');
  expect(written).toBeDefined();
  expect(written).toContain('# Dependabot diagnostic — `acme`');

  expect(analytics.capturedEvents('run_started')[0]?.properties).toMatchObject({
    window_days: 90,
    has_include: false,
    has_exclude: false,
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
  const { ctx, io, githubClient } = createFakeContext();
  githubClient.onPaginate('GET /orgs/{org}/repos', {}).fails({ kind: 'forbidden', message: 'no access' });

  const code = await main(ctx, ['acme']);
  expect(code).toBe(1);
  expect(io.stderr.text()).toContain('403');
});
