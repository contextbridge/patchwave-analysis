import { expect, test } from 'bun:test';
import { repoMeta } from '../testFactories.ts';
import { FakeGithubClient } from '../testHelpers/index.ts';
import type { SecurityUpdatesSlice } from '../types.ts';
import { getSecurityUpdates } from './securityUpdates.ts';

const ROUTE = 'GET /repos/{owner}/{repo}/automated-security-fixes';

const RESPONSES: [{ enabled: boolean; paused: boolean }, SecurityUpdatesSlice['status']][] = [
  [{ enabled: true, paused: true }, 'paused'],
  [{ enabled: true, paused: false }, 'enabled'],
  [{ enabled: false, paused: false }, 'disabled'],
];

test.each(RESPONSES)('maps %o to %s', async (response, status) => {
  const client = new FakeGithubClient();
  client.onRequest(ROUTE, { owner: 'acme', repo: 'widgets' }).resolves(response);

  const result = await getSecurityUpdates(client, repoMeta.build());

  expect(result.unwrapOr(null)).toEqual({ owner: 'acme', name: 'widgets', status });
});

test.each(['not-found', 'forbidden'] as const)('treats %s as unknown rather than disabled', async (kind) => {
  const client = new FakeGithubClient();
  client.onRequest(ROUTE).fails({ kind, message: 'nope' });

  const result = await getSecurityUpdates(client, repoMeta.build());

  expect(result.unwrapOr(null)).toMatchObject({ status: 'unknown' });
});

test('returns other failures as errors', async () => {
  const client = new FakeGithubClient();
  client.onRequest(ROUTE).fails({ kind: 'http', status: 502, message: 'Bad Gateway' });

  const result = await getSecurityUpdates(client, repoMeta.build());

  expect(result.isErr()).toBe(true);
});
