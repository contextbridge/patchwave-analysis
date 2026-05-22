import { expect, test } from 'bun:test';
import { dependabotPr } from '../testFactories.ts';
import { FakeGithubClient } from '../testHelpers/index.ts';
import { indexDependabotPrsByRepo, listReverts } from './reverts.ts';

test('recognises a revert commit and links it back to the Dependabot PR number', async () => {
  const client = new FakeGithubClient();
  client.onPaginate('GET /repos/{owner}/{repo}/commits', {}).resolves([
    {
      sha: 'abc1',
      commit: {
        message: 'Revert "Bump lodash from 4.17.20 to 4.17.21" (#42)\n\nSome extra body.',
        committer: { date: '2026-04-15T00:00:00Z' },
      },
    },
    {
      sha: 'abc2',
      commit: { message: 'Add a feature', committer: { date: '2026-04-16T00:00:00Z' } },
    },
  ]);

  const result = await listReverts(client, { owner: 'acme', name: 'widgets' }, '2026-01-01T00:00:00Z', new Set([42]));
  expect(result.isOk()).toBe(true);
  const reverts = result._unsafeUnwrap();
  expect(reverts).toHaveLength(1);
  expect(reverts[0]).toMatchObject({
    sha: 'abc1',
    revertedPrNumber: 42,
    revertsDependabotPr: true,
  });
});

test('marks revertsDependabotPr false when the reverted PR is unrelated', async () => {
  const client = new FakeGithubClient();
  client.onPaginate('GET /repos/{owner}/{repo}/commits', {}).resolves([
    {
      sha: 'abc1',
      commit: {
        message: 'Revert "Some unrelated feature" (#999)',
        committer: { date: '2026-04-15T00:00:00Z' },
      },
    },
  ]);

  const result = await listReverts(client, { owner: 'acme', name: 'widgets' }, '2026-01-01T00:00:00Z', new Set([42]));
  expect(result._unsafeUnwrap()[0]).toMatchObject({
    revertedPrNumber: 999,
    revertsDependabotPr: false,
  });
});

test('propagates errors instead of returning an empty list', async () => {
  const client = new FakeGithubClient();
  client.onPaginate('GET /repos/{owner}/{repo}/commits', {}).fails({ kind: 'http', status: 500, message: 'boom' });

  const result = await listReverts(client, { owner: 'acme', name: 'widgets' }, '2026-01-01T00:00:00Z', new Set());
  expect(result.isErr()).toBe(true);
});

test('indexDependabotPrsByRepo groups PRs by owner/name', () => {
  const prs = [
    dependabotPr.build({ owner: 'acme', name: 'a', number: 1 }),
    dependabotPr.build({ owner: 'acme', name: 'a', number: 2 }),
    dependabotPr.build({ owner: 'acme', name: 'b', number: 3 }),
  ];
  const index = indexDependabotPrsByRepo(prs);
  expect(index.get('acme/a')).toEqual(new Set([1, 2]));
  expect(index.get('acme/b')).toEqual(new Set([3]));
});
