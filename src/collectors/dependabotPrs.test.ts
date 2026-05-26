import { expect, test } from 'bun:test';
import { FakeGithubClient } from '../testHelpers/index.ts';
import { listDependabotPrs } from './dependabotPrs.ts';
import { rawPullRequest } from './testFactories.ts';

test('maps a single page of search results to DependabotPr', async () => {
  const client = new FakeGithubClient();
  client.onGraphql('DependabotPrs').resolves({
    search: {
      pageInfo: { hasNextPage: false, endCursor: null },
      nodes: [
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
      ],
    },
  });

  const result = await listDependabotPrs(client, 'acme', '2026-01-01T00:00:00Z');
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
  client.onGraphql('DependabotPrs').resolves({
    search: {
      pageInfo: { hasNextPage: false, endCursor: null },
      nodes: [
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
      ],
    },
  });

  const result = await listDependabotPrs(client, 'acme', '2026-01-01T00:00:00Z');
  const prs = result.unwrapOr([]);
  expect(prs[0]).toMatchObject({
    mergedBy: null,
    reviewers: ['carol'],
    commenters: [],
  });
});

test('pages through results when hasNextPage is true', async () => {
  const client = new FakeGithubClient();
  // First page returns cursor; second returns no more.
  client
    .onGraphql((_q, vars) => vars.cursor === null)
    .resolves({
      search: {
        pageInfo: { hasNextPage: true, endCursor: 'CURSOR_1' },
        nodes: [rawPullRequest.build({ number: 1 })],
      },
    });
  client
    .onGraphql((_q, vars) => vars.cursor === 'CURSOR_1')
    .resolves({
      search: {
        pageInfo: { hasNextPage: false, endCursor: null },
        nodes: [rawPullRequest.build({ number: 2 })],
      },
    });

  const result = await listDependabotPrs(client, 'acme', '2026-01-01T00:00:00Z');
  expect(result.isOk()).toBe(true);
  expect(result.unwrapOr([]).map((p) => p.number)).toEqual([1, 2]);
  expect(client.callsTo('graphql')).toHaveLength(2);
});

test('propagates errors from the GraphQL call', async () => {
  const client = new FakeGithubClient();
  client.onGraphql('DependabotPrs').fails({ kind: 'forbidden', message: 'no access' });

  const result = await listDependabotPrs(client, 'acme', '2026-01-01T00:00:00Z');
  expect(result.isErr()).toBe(true);
});
