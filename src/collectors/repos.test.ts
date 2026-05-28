import { expect, test } from 'bun:test';
import { FakeGithubClient } from '../testHelpers/index.ts';
import { listTargetRepos } from './repos.ts';

test('listTargetRepos returns kind=org and maps raw repos including dependabotAlertsEnabled', async () => {
  const client = new FakeGithubClient();
  client.onPaginate('GET /orgs/{org}/repos', {}).resolves([
    {
      name: 'widgets',
      node_id: 'R_kgDOwidgets',
      owner: { login: 'acme' },
      private: false,
      visibility: 'public',
      archived: false,
      fork: false,
      default_branch: 'main',
      language: 'TypeScript',
      pushed_at: '2026-04-01T00:00:00Z',
      security_and_analysis: {
        dependabot_alerts: { status: 'enabled' },
        dependabot_security_updates: { status: 'enabled' },
      },
    },
    {
      name: 'legacy',
      node_id: 'R_kgDOlegacy',
      owner: { login: 'acme' },
      private: true,
      visibility: 'private',
      archived: false,
      fork: false,
      default_branch: 'main',
      language: null,
      pushed_at: null,
      security_and_analysis: {
        dependabot_alerts: { status: 'disabled' },
      },
    },
    {
      name: 'unknown-status',
      node_id: 'R_kgDOunknown',
      owner: { login: 'acme' },
      private: true,
      visibility: 'private',
      archived: false,
      fork: false,
      default_branch: 'main',
      language: null,
      pushed_at: null,
    },
  ]);

  const result = await listTargetRepos(client, 'acme');
  expect(result.isOk()).toBe(true);
  if (result.isOk()) {
    expect(result.value.kind).toBe('org');
    expect(result.value.repos).toHaveLength(3);
    expect(result.value.repos[0]).toMatchObject({
      owner: 'acme',
      name: 'widgets',
      nodeId: 'R_kgDOwidgets',
      dependabotAlertsEnabled: true,
      dependabotSecurityUpdates: true,
    });
    expect(result.value.repos[1]).toMatchObject({ dependabotAlertsEnabled: false });
    expect(result.value.repos[2]).toMatchObject({ dependabotAlertsEnabled: null });
  }
});

test('listTargetRepos returns kind=user when the org endpoint 404s', async () => {
  const client = new FakeGithubClient();
  client.onPaginate('GET /orgs/{org}/repos', {}).fails({ kind: 'not-found', message: 'no org' });
  client.onPaginate('GET /users/{username}/repos', {}).resolves([
    {
      name: 'solo',
      node_id: 'R_kgDOsolo',
      owner: { login: 'blimmer' },
      private: false,
      visibility: 'public',
      archived: false,
      fork: false,
      default_branch: 'main',
      language: 'TypeScript',
      pushed_at: '2026-04-01T00:00:00Z',
    },
  ]);

  const result = await listTargetRepos(client, 'blimmer');
  expect(result.isOk()).toBe(true);
  if (result.isOk()) {
    expect(result.value.kind).toBe('user');
    expect(result.value.repos[0]).toMatchObject({ owner: 'blimmer', name: 'solo' });
  }
});

test('listTargetRepos propagates non-404 errors', async () => {
  const client = new FakeGithubClient();
  client.onPaginate('GET /orgs/{org}/repos', {}).fails({ kind: 'forbidden', message: 'no access' });

  const result = await listTargetRepos(client, 'acme');
  expect(result.isErr()).toBe(true);
  if (result.isErr()) expect(result.error).toMatchObject({ kind: 'forbidden' });
});
