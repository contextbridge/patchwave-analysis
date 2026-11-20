import { expect, test } from 'bun:test';
import { repoMeta } from '../testFactories.ts';
import { createFakeContext } from '../testHelpers/index.ts';
import { instantFromString } from '../time.ts';
import { allActiveRepositorySelection } from '../types.ts';
import { collectAll } from './collectAll.ts';

const ROUTE = 'GET /repos/{owner}/{repo}/automated-security-fixes';
const REPOS = [
  repoMeta.build({ name: 'admin' }),
  repoMeta.build({ name: 'member' }),
  repoMeta.build({ name: 'archived', archived: true }),
];

test('reads security-update status for every active repo', async () => {
  const { ctx, githubClient } = createFakeContext();
  githubClient.onPaginate('GET /repos/{owner}/{repo}/dependabot/alerts').resolves([]);
  githubClient.onGraphql(() => true).resolves(searchPage([]));
  githubClient.onRequest(ROUTE, { repo: 'admin' }).resolves({ enabled: true, paused: true });
  githubClient.onRequest(ROUTE, { repo: 'member' }).fails({ kind: 'not-found', message: 'Not Found' });

  const data = await collectAll(ctx, {
    repos: REPOS,
    target: 'acme',
    targetKind: 'user',
    windowDays: 90,
    windowStart: instantFromString('2026-02-21T00:00:00Z'),
    now: instantFromString('2026-05-22T00:00:00Z'),
    repositorySelection: allActiveRepositorySelection(REPOS),
  });

  expect(githubClient.callsTo('request')).toMatchObject([
    { params: { repo: 'admin' } },
    { params: { repo: 'member' } },
  ]);
  expect(data.securityUpdates).toEqual([
    { owner: 'acme', name: 'admin', status: 'paused' },
    { owner: 'acme', name: 'member', status: 'unknown' },
  ]);
});

function searchPage(nodes: unknown[]): Record<string, unknown> {
  return { search: { issueCount: nodes.length, pageInfo: { hasNextPage: false, endCursor: null }, nodes } };
}
