import { expect, test } from 'bun:test';
import { FakeGithubClient } from '../testHelpers/index.ts';
import { buildCountQueries, listDependabotPrCounts } from './dependabotPrCounts.ts';

test('builds org-scoped queries with archived:false and the window date', () => {
  const q = buildCountQueries('acme', 'org', '2026-03-04T00:00:00Z');
  expect(q.open).toBe('is:pr author:app/dependabot archived:false org:acme is:open');
  expect(q.merged).toBe('is:pr author:app/dependabot archived:false org:acme is:merged merged:>=2026-03-04');
  expect(q.closedUnmerged).toBe(
    'is:pr author:app/dependabot archived:false org:acme is:unmerged is:closed closed:>=2026-03-04',
  );
});

test('uses the user: qualifier for user targets', () => {
  const q = buildCountQueries('blimmer', 'user', '2026-03-04T00:00:00Z');
  expect(q.open).toBe('is:pr author:app/dependabot archived:false user:blimmer is:open');
});

test('maps the three aliased search counts to DependabotPrCounts', async () => {
  const client = new FakeGithubClient();
  client.onGraphql('DependabotPrCounts').resolves({
    open: { issueCount: 12 },
    merged: { issueCount: 30 },
    closedUnmerged: { issueCount: 5 },
  });

  const result = await listDependabotPrCounts(client, 'acme', 'org', '2026-03-04T00:00:00Z');

  expect(result.isOk()).toBe(true);
  if (result.isOk()) {
    expect(result.value).toEqual({ open: 12, mergedInWindow: 30, closedUnmergedInWindow: 5 });
  }
});

test('propagates a GithubError (e.g. empty-response) instead of inventing zeros', async () => {
  const client = new FakeGithubClient();
  client.onGraphql('DependabotPrCounts').resolves(undefined);

  const result = await listDependabotPrCounts(client, 'acme', 'org', '2026-03-04T00:00:00Z');

  expect(result.isErr()).toBe(true);
});
