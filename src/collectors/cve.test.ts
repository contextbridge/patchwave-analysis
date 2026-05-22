import { expect, test } from 'bun:test';
import { FakeGithubClient } from '../testHelpers/index.ts';
import { getCveAlerts } from './cve.ts';

test('maps raw alerts to CveAlert with normalized severity', async () => {
  const client = new FakeGithubClient();
  client.onPaginate('GET /repos/{owner}/{repo}/dependabot/alerts', {}).resolves([
    {
      number: 1,
      state: 'open',
      created_at: '2026-03-01T00:00:00Z',
      security_advisory: { summary: 'Critical RCE' },
      security_vulnerability: {
        severity: 'Critical',
        package: { name: 'left-pad', ecosystem: 'npm' },
      },
    },
    {
      number: 2,
      state: 'open',
      created_at: '2026-04-01T00:00:00Z',
      security_advisory: { summary: 'Moderate issue' },
      security_vulnerability: {
        severity: 'moderate',
        package: { name: 'lodash', ecosystem: 'npm' },
      },
    },
  ]);

  const result = await getCveAlerts(client, { owner: 'acme', name: 'widgets' });
  expect(result.isOk()).toBe(true);
  const slice = result._unsafeUnwrap();
  expect(slice.status).toBe('ok');
  if (slice.status === 'ok') {
    expect(slice.alerts).toHaveLength(2);
    expect(slice.alerts[0]).toMatchObject({ severity: 'critical', packageName: 'left-pad' });
    expect(slice.alerts[1]).toMatchObject({ severity: 'medium', packageName: 'lodash' });
  }
});

test('converts a scope-missing error into the corresponding slice', async () => {
  const client = new FakeGithubClient();
  client
    .onPaginate('GET /repos/{owner}/{repo}/dependabot/alerts', {})
    .fails({ kind: 'scope-missing', required: 'security_events', message: 'missing scope' });

  const result = await getCveAlerts(client, { owner: 'acme', name: 'widgets' });
  expect(result.isOk()).toBe(true);
  expect(result._unsafeUnwrap()).toEqual({
    status: 'scope-missing',
    requiredScope: 'security_events',
  });
});

test("converts a 404 into 'not-enabled'", async () => {
  const client = new FakeGithubClient();
  client
    .onPaginate('GET /repos/{owner}/{repo}/dependabot/alerts', {})
    .fails({ kind: 'not-found', message: 'not found' });

  const result = await getCveAlerts(client, { owner: 'acme', name: 'widgets' });
  expect(result.isOk()).toBe(true);
  expect(result._unsafeUnwrap()).toEqual({ status: 'not-enabled' });
});

test('propagates other errors instead of pretending alerts are disabled', async () => {
  const client = new FakeGithubClient();
  client
    .onPaginate('GET /repos/{owner}/{repo}/dependabot/alerts', {})
    .fails({ kind: 'http', status: 503, message: 'service unavailable' });

  const result = await getCveAlerts(client, { owner: 'acme', name: 'widgets' });
  expect(result.isErr()).toBe(true);
  expect(result._unsafeUnwrapErr()).toMatchObject({ kind: 'http', status: 503 });
});
