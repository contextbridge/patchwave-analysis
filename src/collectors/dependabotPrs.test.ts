import { expect, test } from 'bun:test';
import { repoMeta } from '../testFactories.ts';
import { FakeGithubClient } from '../testHelpers/index.ts';
import { listDependabotPrs } from './dependabotPrs.ts';
import { rawPullRequest } from './testFactories.ts';

const WINDOW = '2026-01-01T00:00:00Z';

test('maps a single repo page of PRs to DependabotPr', async () => {
  const client = new FakeGithubClient();
  client.onGraphql('DependabotPrsBatch').resolves(
    batch([
      repoNode([
        rawPullRequest.build({
          state: 'MERGED',
          mergedAt: '2026-04-05T00:00:00Z',
          mergedBy: { __typename: 'User', login: 'alice' },
          reviews: {
            nodes: [
              { author: { __typename: 'User', login: 'bob' } },
              { author: { __typename: 'User', login: 'alice' } },
            ],
          },
          comments: { nodes: [{ author: { __typename: 'User', login: 'alice' } }] },
        }),
      ]),
    ]),
  );

  const result = await listDependabotPrs(client, [repoMeta.build()], WINDOW);
  expect(result.isOk()).toBe(true);
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

test('drops bot actors from mergers, reviewers, and commenters', async () => {
  const client = new FakeGithubClient();
  client.onGraphql('DependabotPrsBatch').resolves(
    batch([
      repoNode([
        rawPullRequest.build({
          state: 'MERGED',
          mergedAt: '2026-04-05T00:00:00Z',
          // A GitHub App that merged the PR: Bot typename, no [bot] suffix.
          mergedBy: { __typename: 'Bot', login: 'auto-merge-app' },
          reviews: {
            nodes: [
              { author: { __typename: 'Bot', login: 'greptile-apps' } },
              { author: { __typename: 'User', login: 'carol' } },
            ],
          },
          comments: { nodes: [{ author: { __typename: 'Bot', login: 'dependabot' } }] },
        }),
      ]),
    ]),
  );

  const result = await listDependabotPrs(client, [repoMeta.build()], WINDOW);
  expect(result.unwrapOr([])[0]).toMatchObject({
    mergedBy: null,
    reviewers: ['carol'],
    commenters: [],
  });
});

test('keeps only Dependabot-authored PRs', async () => {
  const client = new FakeGithubClient();
  client
    .onGraphql('DependabotPrsBatch')
    .resolves(
      batch([
        repoNode([
          rawPullRequest.build({ number: 1, author: { __typename: 'User', login: 'human' } }),
          rawPullRequest.build({ number: 2, author: { __typename: 'Bot', login: 'dependabot' } }),
        ]),
      ]),
    );

  const result = await listDependabotPrs(client, [repoMeta.build()], WINDOW);
  expect(result.unwrapOr([]).map((p) => p.number)).toEqual([2]);
});

test('excludes PRs updated before the window and stops paging at the window edge', async () => {
  const client = new FakeGithubClient();
  client.onGraphql('DependabotPrsBatch').resolves(
    batch([
      repoNode(
        [
          rawPullRequest.build({ number: 1, updatedAt: '2026-04-01T00:00:00Z' }),
          rawPullRequest.build({ number: 2, updatedAt: '2025-12-01T00:00:00Z' }),
        ],
        // Even though the connection claims more pages, the older PR proves we've
        // crossed the window edge, so no follow-up page is fetched.
        { hasNextPage: true, endCursor: 'C1' },
      ),
    ]),
  );

  const result = await listDependabotPrs(client, [repoMeta.build()], WINDOW);
  expect(result.unwrapOr([]).map((p) => p.number)).toEqual([1]);
  expect(client.callsTo('graphql')).toHaveLength(1);
});

test('pages a single repo when its first page is full of in-window PRs', async () => {
  const client = new FakeGithubClient();
  client
    .onGraphql((_q, vars) => vars.cursor === null)
    .resolves(batch([repoNode([rawPullRequest.build({ number: 1 })], { hasNextPage: true, endCursor: 'C1' })]));
  client
    .onGraphql((_q, vars) => vars.cursor === 'C1')
    .resolves(batch([repoNode([rawPullRequest.build({ number: 2 })], { hasNextPage: false })]));

  const result = await listDependabotPrs(client, [repoMeta.build()], WINDOW);
  expect(result.unwrapOr([]).map((p) => p.number)).toEqual([1, 2]);
  expect(client.callsTo('graphql')).toHaveLength(2);
});

test('collects PRs across multiple repos in one batched query', async () => {
  const client = new FakeGithubClient();
  client
    .onGraphql('DependabotPrsBatch')
    .resolves(
      batch([
        repoNode([rawPullRequest.build({ number: 1 })], { id: 'R_widgets', name: 'widgets' }),
        repoNode([rawPullRequest.build({ number: 2 })], { id: 'R_gadgets', name: 'gadgets' }),
      ]),
    );

  const result = await listDependabotPrs(
    client,
    [
      repoMeta.build({ name: 'widgets', nodeId: 'R_widgets' }),
      repoMeta.build({ name: 'gadgets', nodeId: 'R_gadgets' }),
    ],
    WINDOW,
  );
  const prs = result.unwrapOr([]);
  expect(prs.map((p) => `${p.name}#${p.number}`).sort()).toEqual(['gadgets#2', 'widgets#1']);
  expect(client.callsTo('graphql')).toHaveLength(1);
});

test('propagates the error when every batch fails', async () => {
  const client = new FakeGithubClient();
  client.onGraphql('DependabotPrsBatch').fails({ kind: 'forbidden', message: 'no access' });

  const result = await listDependabotPrs(client, [repoMeta.build()], WINDOW);
  expect(result.isErr()).toBe(true);
});

interface RepoNodeOptions {
  readonly id?: string;
  readonly owner?: string;
  readonly name?: string;
  readonly hasNextPage?: boolean;
  readonly endCursor?: string | null;
}

function repoNode(prs: unknown[], options: RepoNodeOptions = {}): Record<string, unknown> {
  const { id = 'R_widgets', owner = 'acme', name = 'widgets', hasNextPage = false, endCursor = null } = options;
  return {
    __typename: 'Repository',
    id,
    owner: { login: owner },
    name,
    pullRequests: { pageInfo: { hasNextPage, endCursor }, nodes: prs },
  };
}

function batch(nodes: unknown[]): Record<string, unknown> {
  return { nodes };
}
