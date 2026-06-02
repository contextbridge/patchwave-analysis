import { expect, test } from 'bun:test';
import { FakeGithubClient } from '../testHelpers/index.ts';
import { listDependabotPrCounts } from './dependabotPrCounts.ts';

test('issues archived:false, author-scoped search queries for an org target', async () => {
  const client = new FakeGithubClient();
  client.onGraphql('DependabotPrCounts').resolves({
    open: { issueCount: 0 },
    merged: { issueCount: 0 },
    closedUnmerged: { issueCount: 0 },
  });
  await listDependabotPrCounts(client, 'acme', 'org', '2026-03-04T00:00:00Z');
  const call = client.callsTo('graphql')[0];
  expect(call).toBeDefined();
  if (call && call.kind === 'graphql') {
    expect(call.variables).toEqual({
      open: 'is:pr author:app/dependabot archived:false org:acme is:open',
      merged: 'is:pr author:app/dependabot archived:false org:acme is:merged merged:>=2026-03-04',
      closedUnmerged: 'is:pr author:app/dependabot archived:false org:acme is:unmerged is:closed closed:>=2026-03-04',
    });
  }
});

test('uses the user: qualifier for user targets', async () => {
  const client = new FakeGithubClient();
  client.onGraphql('DependabotPrCounts').resolves({
    open: { issueCount: 0 },
    merged: { issueCount: 0 },
    closedUnmerged: { issueCount: 0 },
  });
  await listDependabotPrCounts(client, 'blimmer', 'user', '2026-03-04T00:00:00Z');
  const call = client.callsTo('graphql')[0];
  if (call && call.kind === 'graphql') {
    expect(call.variables.open).toBe('is:pr author:app/dependabot archived:false user:blimmer is:open');
  }
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
