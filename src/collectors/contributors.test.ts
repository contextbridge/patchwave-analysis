import { expect, test } from 'bun:test';
import { FakeGithubClient } from '../testHelpers/index.ts';
import { listActiveCommitters } from './contributors.ts';

test('returns unique human committers, sorted, skipping bots', async () => {
  const client = new FakeGithubClient();
  client.onPaginate('GET /repos/{owner}/{repo}/commits', {}).resolves([
    { author: { login: 'alice', type: 'User' }, commit: { author: { name: 'a', date: '' } } },
    { author: { login: 'bob', type: 'User' }, commit: { author: { name: 'b', date: '' } } },
    { author: { login: 'alice', type: 'User' }, commit: { author: { name: 'a', date: '' } } },
    { author: { login: 'dependabot[bot]', type: 'Bot' }, commit: { author: { name: 'd', date: '' } } },
    { author: { login: 'renovate[bot]', type: 'User' }, commit: { author: { name: 'r', date: '' } } },
    { author: null, commit: { author: null } },
  ]);

  const result = await listActiveCommitters(client, { owner: 'acme', name: 'widgets' }, '2026-01-01T00:00:00Z');
  expect(result.isOk()).toBe(true);
  expect(result._unsafeUnwrap()).toMatchObject({
    owner: 'acme',
    name: 'widgets',
    activeHumanLogins: ['alice', 'bob'],
  });
});

test('propagates errors instead of swallowing them', async () => {
  const client = new FakeGithubClient();
  client.onPaginate('GET /repos/{owner}/{repo}/commits', {}).fails({ kind: 'forbidden', message: 'no access' });

  const result = await listActiveCommitters(client, { owner: 'acme', name: 'widgets' }, '2026-01-01T00:00:00Z');
  expect(result.isErr()).toBe(true);
  expect(result._unsafeUnwrapErr()).toMatchObject({ kind: 'forbidden' });
});
