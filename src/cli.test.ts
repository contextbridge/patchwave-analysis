import { expect, test } from 'bun:test';
import { main } from './cli.ts';
import { createFakeContext } from './testHelpers/index.ts';
import type { FakeGithubClient } from './testHelpers/index.ts';

// The Dependabot PR search is the only GraphQL call; resolve it empty so the
// happy-path tests reach the report without exercising the search internals.
function stubEmptyPrSearch(githubClient: FakeGithubClient): void {
  githubClient.onGraphql('DependabotPrsSearch').resolves({
    search: { issueCount: 0, pageInfo: { hasNextPage: false, endCursor: null }, nodes: [] },
  });
}

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

test('rejects unknown flags', async () => {
  const { ctx, io } = createFakeContext();
  const result = await main(ctx, ['acme', '--window', '30d']);
  expect(result).toMatchObject({ kind: 'usage', code: 1 });
  expect(io.stderr.text()).toContain('failed to parse arguments');
});

test('rejects more than one positional argument', async () => {
  const { ctx, io } = createFakeContext();
  const result = await main(ctx, ['acme', 'globex']);
  expect(result).toMatchObject({ kind: 'usage', code: 1 });
  expect(io.stderr.text()).toContain('expected a single org or user');
});

test('writes a report when the GitHub calls succeed', async () => {
  const { ctx, githubClient, fs, analytics, prompter } = createFakeContext();

  githubClient.onPaginate('GET /orgs/{org}/repos', {}).resolves([
    {
      name: 'widgets',
      node_id: 'R_kgDOwidgets',
      owner: { login: 'acme' },
      private: true,
      visibility: 'private',
      archived: false,
      default_branch: 'main',
      language: 'TypeScript',
      pushed_at: '2026-04-01T00:00:00Z',
    },
  ]);
  githubClient.onPaginate('GET /orgs/{org}/dependabot/alerts', {}).resolves([]);
  stubEmptyPrSearch(githubClient);

  const result = await main(ctx, ['acme']);
  expect(result.kind).toBe('completed');
  if (result.kind !== 'completed') return;
  expect(result.code).toBe(0);

  // Output lands in a temp dir, not the CWD; locate it via the returned paths.
  expect(result.run.target).toBe('acme');
  expect(result.run.htmlPath.endsWith('patchwave-report.html')).toBe(true);

  const written = fs.read(result.run.htmlPath);
  expect(written).toBeDefined();
  expect(written).toContain('<html');
  const match = /<script type="application\/json" id="patchwave-data">([\s\S]*?)<\/script>/.exec(written ?? '');
  expect(match).not.toBeNull();
  const embedded = JSON.parse(match?.[1] ?? '') as { meta: { org: string } };
  expect(embedded.meta.org).toBe('acme');

  // The completed run hands the html back so the caller (index.ts) can drive
  // the share prompt without re-reading the filesystem.
  expect(result.run.html).toContain('<html');
  expect(prompter.spinnerEvents).toContainEqual({ type: 'stop', message: 'Scanned acme.' });

  expect(analytics.capturedEvents('run_started')[0]?.properties).toMatchObject({
    window_days: 90,
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

test('excludes forked repos from the crawl', async () => {
  const { ctx, githubClient, analytics } = createFakeContext();

  githubClient.onPaginate('GET /orgs/{org}/repos', {}).resolves([
    {
      name: 'widgets',
      node_id: 'R_kgDOwidgets',
      owner: { login: 'acme' },
      private: true,
      visibility: 'private',
      archived: false,
      fork: false,
      default_branch: 'main',
      language: 'TypeScript',
      pushed_at: '2026-04-01T00:00:00Z',
    },
    {
      name: 'upstream-fork',
      node_id: 'R_kgDOfork',
      owner: { login: 'acme' },
      private: false,
      visibility: 'public',
      archived: false,
      fork: true,
      default_branch: 'main',
      language: 'Go',
      pushed_at: '2026-04-01T00:00:00Z',
    },
  ]);
  githubClient.onPaginate('GET /orgs/{org}/dependabot/alerts', {}).resolves([]);
  stubEmptyPrSearch(githubClient);

  const result = await main(ctx, ['acme']);
  expect(result.kind).toBe('completed');

  expect(analytics.capturedEvents('run_completed')[0]?.properties).toMatchObject({
    repos_total: 2,
    repos_included: 1,
  });
});

test('uses the per-repo CVE endpoint for user targets', async () => {
  const { ctx, githubClient } = createFakeContext();

  // User-target fallthrough: /orgs/{org}/repos 404s, /users/{username}/repos succeeds.
  githubClient.onPaginate('GET /orgs/{org}/repos', {}).fails({ kind: 'not-found', message: 'no org' });
  githubClient.onPaginate('GET /users/{username}/repos', {}).resolves([
    {
      name: 'solo',
      node_id: 'R_kgDOsolo',
      owner: { login: 'blimmer' },
      private: false,
      visibility: 'public',
      archived: false,
      fork: false,
      default_branch: 'main',
      language: 'TypeScript',
      pushed_at: '2026-04-01T00:00:00Z',
    },
  ]);
  // Per-repo CVE endpoint — the path kept for user targets.
  githubClient.onPaginate('GET /repos/{owner}/{repo}/dependabot/alerts', {}).resolves([]);
  stubEmptyPrSearch(githubClient);

  const result = await main(ctx, ['blimmer']);
  expect(result.kind).toBe('completed');

  const paginateRoutes = githubClient.callsTo('paginate').flatMap((c) => (c.kind === 'paginate' ? [c.route] : []));
  expect(paginateRoutes).toContain('GET /repos/{owner}/{repo}/dependabot/alerts');
  expect(paginateRoutes).not.toContain('GET /orgs/{org}/dependabot/alerts');
});

test('falls back to the per-repo CVE endpoint when the org-level call fails', async () => {
  const { ctx, githubClient } = createFakeContext();

  githubClient.onPaginate('GET /orgs/{org}/repos', {}).resolves([
    {
      name: 'widgets',
      node_id: 'R_kgDOwidgets',
      owner: { login: 'acme' },
      private: true,
      visibility: 'private',
      archived: false,
      default_branch: 'main',
      language: 'TypeScript',
      pushed_at: '2026-04-01T00:00:00Z',
    },
  ]);
  // Org-level endpoint refuses: token can see the org but not its alerts.
  githubClient
    .onPaginate('GET /orgs/{org}/dependabot/alerts', {})
    .fails({ kind: 'forbidden', message: 'no access to org alerts' });
  // Per-repo endpoint is the fallback so each repo still gets a real status.
  githubClient.onPaginate('GET /repos/{owner}/{repo}/dependabot/alerts', {}).resolves([]);
  stubEmptyPrSearch(githubClient);

  const result = await main(ctx, ['acme']);
  expect(result.kind).toBe('completed');

  const paginateRoutes = githubClient.callsTo('paginate').flatMap((c) => (c.kind === 'paginate' ? [c.route] : []));
  expect(paginateRoutes).toContain('GET /orgs/{org}/dependabot/alerts');
  expect(paginateRoutes).toContain('GET /repos/{owner}/{repo}/dependabot/alerts');
});

test('aborts before scanning when the token is missing a required scope', async () => {
  const { ctx, githubClient, prompter, analytics } = createFakeContext();
  githubClient.setOAuthScopes(['read:org']); // missing `repo`

  const result = await main(ctx, ['acme']);

  expect(result).toMatchObject({ kind: 'failed', code: 1 });
  // The gate fires before any repo listing or scan.
  expect(githubClient.callsTo('paginate')).toHaveLength(0);
  expect(githubClient.callsTo('graphql')).toHaveLength(0);
  expect(prompter.notes.some((n) => n.title === 'Fix the token')).toBe(true);
  expect(analytics.capturedEvents('run_failed')[0]?.properties).toMatchObject({
    error_kind: 'token-scope-insufficient',
  });
});

test('rejects a fine-grained token, which carries no scopes header', async () => {
  const { ctx, githubClient, prompter } = createFakeContext();
  githubClient.setOAuthScopes(null);

  const result = await main(ctx, ['acme']);

  expect(result).toMatchObject({ kind: 'failed', code: 1 });
  expect(prompter.notes.some((n) => n.message.includes('classic token'))).toBe(true);
});

test('captures run_failed when listTargetRepos fails', async () => {
  const { ctx, githubClient, analytics } = createFakeContext();
  githubClient.onPaginate('GET /orgs/{org}/repos', {}).fails({ kind: 'forbidden', message: 'no access' });

  await main(ctx, ['acme']);

  const failed = analytics.capturedEvents('run_failed')[0];
  expect(failed?.properties).toMatchObject({ error_kind: 'forbidden' });
});

test('returns failed when listTargetRepos fails non-recoverably', async () => {
  const { ctx, prompter, githubClient } = createFakeContext();
  githubClient.onPaginate('GET /orgs/{org}/repos', {}).fails({ kind: 'forbidden', message: 'no access' });

  const result = await main(ctx, ['acme']);
  expect(result).toMatchObject({ kind: 'failed', code: 1 });
  expect(prompter.errors[0]).toContain('403');
});

test('returns failed when the temp output directory cannot be created', async () => {
  const { ctx, fs, prompter, analytics } = createFakeContext();
  fs.failNextTempDirWith({ kind: 'temp-dir-failed', message: 'disk full' });

  const result = await main(ctx, ['acme']);

  expect(result).toMatchObject({ kind: 'failed', code: 1 });
  expect(prompter.errors[0]).toContain('temporary output directory');
  expect(analytics.capturedEvents('run_failed')[0]?.properties).toMatchObject({ error_kind: 'temp-dir-failed' });
});
