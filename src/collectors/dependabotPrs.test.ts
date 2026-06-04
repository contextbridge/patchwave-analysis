import { expect, test } from 'bun:test';
import { createFakeContext } from '../testHelpers/index.ts';
import { listDependabotPrs } from './dependabotPrs.ts';
import { rawPullRequest } from './testFactories.ts';

const WINDOW_START = '2026-05-01T00:00:00Z';
const NOW = '2026-05-02T00:00:00Z';

test('maps PRs, dedupes reviewers/commenters, and drops bots', async () => {
  const { ctx, githubClient } = createFakeContext();
  // The open-backlog stream (created) returns nothing; everything comes from the
  // resolved (closed) stream so the assertions stay focused.
  githubClient.onGraphql(() => true).resolves(page([]));
  githubClient
    .onGraphql((_q, v) => String(v.searchQuery).includes('closed:'))
    .resolves(
      page([
        rawPullRequest.build({
          state: 'MERGED',
          mergedAt: '2026-05-01T12:00:00Z',
          mergedBy: { __typename: 'User', login: 'alice' },
          reviews: {
            nodes: [
              { author: { __typename: 'User', login: 'bob' } },
              { author: { __typename: 'User', login: 'alice' } },
              { author: { __typename: 'Bot', login: 'greptile-apps' } },
            ],
          },
          comments: {
            nodes: [
              { author: { __typename: 'User', login: 'alice' } },
              { author: { __typename: 'Bot', login: 'dependabot' } },
            ],
          },
        }),
      ]),
    );

  const result = await listDependabotPrs(ctx, 'acme', 'org', WINDOW_START, NOW);
  const prs = result.unwrapOr([]);
  expect(prs).toHaveLength(1);
  expect(prs[0]).toMatchObject({
    owner: 'acme',
    name: 'widgets',
    state: 'closed',
    merged: true,
    mergedBy: 'alice',
    reviewers: ['alice', 'bob'],
    commenters: ['alice'],
  });
});

test('a bot merger is recorded as no human merger', async () => {
  const { ctx, githubClient } = createFakeContext();
  githubClient.onGraphql(() => true).resolves(page([]));
  githubClient
    .onGraphql((_q, v) => String(v.searchQuery).includes('closed:'))
    .resolves(
      page([
        rawPullRequest.build({
          state: 'MERGED',
          mergedAt: '2026-05-01T12:00:00Z',
          mergedBy: { __typename: 'Bot', login: 'auto-merge-app' },
        }),
      ]),
    );

  const result = await listDependabotPrs(ctx, 'acme', 'org', WINDOW_START, NOW);
  expect(result.unwrapOr([])[0]).toMatchObject({ mergedBy: null });
});

test('uses org: scope for orgs and user: scope for users', async () => {
  const { ctx, githubClient } = createFakeContext();
  githubClient.onGraphql(() => true).resolves(page([]));

  await listDependabotPrs(ctx, 'acme', 'user', WINDOW_START, NOW);
  const queries = githubClient
    .callsTo('graphql')
    .map((c) => (c.kind === 'graphql' ? String(c.variables.searchQuery) : ''));
  expect(queries.every((q) => q.includes('user:acme'))).toBe(true);
  expect(queries.some((q) => q.includes('org:'))).toBe(false);
});

test('bisects the date range when a query exceeds the 1000-result cap', async () => {
  const { ctx, githubClient } = createFakeContext();
  githubClient.onGraphql(() => true).resolves(page([]));
  // Full window is over the cap, so it splits into two single-day sub-queries.
  githubClient
    .onGraphql((_q, v) => String(v.searchQuery).includes('closed:2026-05-01..2026-05-02'))
    .resolves(page([], { issueCount: 2000 }));
  githubClient
    .onGraphql((_q, v) => String(v.searchQuery).includes('closed:2026-05-01..2026-05-01'))
    .resolves(page([rawPullRequest.build({ number: 1 })], { issueCount: 1 }));
  githubClient
    .onGraphql((_q, v) => String(v.searchQuery).includes('closed:2026-05-02..2026-05-02'))
    .resolves(page([rawPullRequest.build({ number: 2 })], { issueCount: 1 }));

  const result = await listDependabotPrs(ctx, 'acme', 'org', WINDOW_START, NOW);
  expect(
    result
      .unwrapOr([])
      .map((p) => p.number)
      .sort(),
  ).toEqual([1, 2]);
});

test('logs an error and truncates when a single day exceeds the cap', async () => {
  const { ctx, githubClient, io } = createFakeContext();
  githubClient.onGraphql(() => true).resolves(page([]));
  // windowStart === now means the resolved stream is a single day that can't split.
  githubClient
    .onGraphql((_q, v) => String(v.searchQuery).includes('closed:2026-05-02..2026-05-02'))
    .resolves(page([rawPullRequest.build({ number: 1 })], { issueCount: 2000 }));

  const result = await listDependabotPrs(ctx, 'acme', 'org', NOW, NOW);
  expect(result.isOk()).toBe(true);
  expect(io.stderr.text()).toContain('more than 1000 results for a single day');
});

test('treats a malformed payload as empty and logs an error instead of crashing', async () => {
  const { ctx, githubClient, io } = createFakeContext();
  githubClient.onGraphql(() => true).resolves({});

  const result = await listDependabotPrs(ctx, 'acme', 'org', WINDOW_START, NOW);
  expect(result.isOk()).toBe(true);
  expect(result.unwrapOr([])).toEqual([]);
  expect(io.stderr.text()).toContain('no `search` payload');
});

test('logs an error when results are reported but none are retrievable', async () => {
  const { ctx, githubClient, io } = createFakeContext();
  githubClient.onGraphql(() => true).resolves(page([], { issueCount: 0 }));
  githubClient.onGraphql((_q, v) => String(v.searchQuery).includes('closed:')).resolves(page([], { issueCount: 5 }));

  const result = await listDependabotPrs(ctx, 'acme', 'org', WINDOW_START, NOW);
  expect(result.isOk()).toBe(true);
  expect(io.stderr.text()).toContain('none were retrievable');
});

test('propagates the error when a search query fails', async () => {
  const { ctx, githubClient } = createFakeContext();
  githubClient.onGraphql(() => true).fails({ kind: 'forbidden', message: 'no access' });

  const result = await listDependabotPrs(ctx, 'acme', 'org', WINDOW_START, NOW);
  expect(result.isErr()).toBe(true);
});

test('does not pass a reserved GraphQL variable name (Octokit rejects `query`)', async () => {
  const { ctx, githubClient } = createFakeContext();
  githubClient.onGraphql(() => true).resolves(page([]));

  // The fake throws on a reserved name, mirroring Octokit; reaching the assertions
  // means the search variable is named safely.
  await listDependabotPrs(ctx, 'acme', 'org', WINDOW_START, NOW);
  const vars = githubClient.callsTo('graphql').map((c) => (c.kind === 'graphql' ? c.variables : {}));
  expect(vars.length).toBeGreaterThan(0);
  expect(vars.every((v) => !('query' in v))).toBe(true);
  expect(vars.every((v) => 'searchQuery' in v)).toBe(true);
});

interface PageOptions {
  readonly issueCount?: number;
  readonly hasNextPage?: boolean;
  readonly endCursor?: string | null;
}

function page(nodes: unknown[], options: PageOptions = {}): Record<string, unknown> {
  const { issueCount = nodes.length, hasNextPage = false, endCursor = null } = options;
  return { search: { issueCount, pageInfo: { hasNextPage, endCursor }, nodes } };
}
