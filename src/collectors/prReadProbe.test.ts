import { describe, expect, test } from 'bun:test';
import { repoRef } from '../testFactories.ts';
import { FakeGithubClient } from '../testHelpers/index.ts';
import { probePrReadAccess } from './prReadProbe.ts';

describe('probePrReadAccess', () => {
  test('reports readable when the pulls endpoint returns', async () => {
    const client = new FakeGithubClient();
    client.onRequest('GET /repos/{owner}/{repo}/pulls').resolves([]);

    expect(await probePrReadAccess(client, repoRef.build())).toEqual({ readable: true });
  });

  test('treats a 403 as an unreadable token (fine-grained without Pull requests)', async () => {
    const client = new FakeGithubClient();
    client.onRequest('GET /repos/{owner}/{repo}/pulls').fails({ kind: 'forbidden', message: 'no access' });

    expect(await probePrReadAccess(client, repoRef.build())).toEqual({ readable: false, reason: 'forbidden' });
  });

  test('treats a scope-missing error as unreadable', async () => {
    const client = new FakeGithubClient();
    client
      .onRequest('GET /repos/{owner}/{repo}/pulls')
      .fails({ kind: 'scope-missing', required: 'repo', message: 'x' });

    expect(await probePrReadAccess(client, repoRef.build())).toEqual({ readable: false, reason: 'forbidden' });
  });

  test('treats a 404 as unreadable (classic token without repo scope on a private repo)', async () => {
    const client = new FakeGithubClient();
    client.onRequest('GET /repos/{owner}/{repo}/pulls').fails({ kind: 'not-found', message: 'gone' });

    expect(await probePrReadAccess(client, repoRef.build())).toEqual({ readable: false, reason: 'not-found' });
  });

  test('stays inconclusive on unrelated errors so the scan is never blocked', async () => {
    const client = new FakeGithubClient();
    const error = { kind: 'network', message: 'offline', cause: new Error('offline') } as const;
    client.onRequest('GET /repos/{owner}/{repo}/pulls').fails(error);

    const verdict = await probePrReadAccess(client, repoRef.build());
    expect(verdict.readable).toBe('unknown');
  });
});
