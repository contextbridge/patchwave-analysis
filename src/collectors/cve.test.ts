import { expect, test } from 'bun:test';
import { repoMeta } from '../testFactories.ts';
import { FakeGithubClient } from '../testHelpers/index.ts';
import { getCveAlerts, getOrgCveAlerts } from './cve.ts';

const ORG_ALERTS = 'GET /orgs/{org}/dependabot/alerts';

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
  if (result.isOk()) {
    const slice = result.value;
    expect(slice.status).toBe('ok');
    if (slice.status === 'ok') {
      expect(slice.alerts).toHaveLength(2);
      expect(slice.alerts[0]).toMatchObject({ severity: 'critical', packageName: 'left-pad' });
      expect(slice.alerts[1]).toMatchObject({ severity: 'medium', packageName: 'lodash' });
    }
  }
});

test('converts a scope-missing error into the corresponding slice', async () => {
  const client = new FakeGithubClient();
  client
    .onPaginate('GET /repos/{owner}/{repo}/dependabot/alerts', {})
    .fails({ kind: 'scope-missing', required: 'security_events', message: 'missing scope' });

  const result = await getCveAlerts(client, { owner: 'acme', name: 'widgets' });
  expect(result.isOk()).toBe(true);
  if (result.isOk()) {
    expect(result.value).toEqual({
      owner: 'acme',
      name: 'widgets',
      status: 'scope-missing',
      requiredScope: 'security_events',
    });
  }
});

test("converts a 404 into 'not-enabled'", async () => {
  const client = new FakeGithubClient();
  client
    .onPaginate('GET /repos/{owner}/{repo}/dependabot/alerts', {})
    .fails({ kind: 'not-found', message: 'not found' });

  const result = await getCveAlerts(client, { owner: 'acme', name: 'widgets' });
  expect(result.isOk()).toBe(true);
  if (result.isOk()) expect(result.value).toEqual({ owner: 'acme', name: 'widgets', status: 'not-enabled' });
});

test("converts a 403 'Dependabot alerts are disabled' into 'not-enabled'", async () => {
  const client = new FakeGithubClient();
  client.onPaginate('GET /repos/{owner}/{repo}/dependabot/alerts', {}).fails({
    kind: 'forbidden',
    message: 'Dependabot alerts are disabled for this repository.',
  });

  const result = await getCveAlerts(client, { owner: 'acme', name: 'widgets' });
  expect(result.isOk()).toBe(true);
  if (result.isOk()) expect(result.value).toEqual({ owner: 'acme', name: 'widgets', status: 'not-enabled' });
});

test('propagates an unrelated 403 instead of swallowing it as not-enabled', async () => {
  const client = new FakeGithubClient();
  client
    .onPaginate('GET /repos/{owner}/{repo}/dependabot/alerts', {})
    .fails({ kind: 'forbidden', message: 'Must have admin rights to Repository.' });

  const result = await getCveAlerts(client, { owner: 'acme', name: 'widgets' });
  expect(result.isErr()).toBe(true);
  if (result.isErr()) expect(result.error).toMatchObject({ kind: 'forbidden' });
});

test('propagates other errors instead of pretending alerts are disabled', async () => {
  const client = new FakeGithubClient();
  client
    .onPaginate('GET /repos/{owner}/{repo}/dependabot/alerts', {})
    .fails({ kind: 'http', status: 503, message: 'service unavailable' });

  const result = await getCveAlerts(client, { owner: 'acme', name: 'widgets' });
  expect(result.isErr()).toBe(true);
  if (result.isErr()) expect(result.error).toMatchObject({ kind: 'http', status: 503 });
});

test('getOrgCveAlerts buckets alerts by repo from the org endpoint', async () => {
  const client = new FakeGithubClient();
  client.onPaginate(ORG_ALERTS, {}).resolves([
    {
      number: 1,
      created_at: '2026-03-01T00:00:00Z',
      security_advisory: { summary: 'Critical RCE' },
      security_vulnerability: { severity: 'critical', package: { name: 'left-pad', ecosystem: 'npm' } },
      repository: { name: 'widgets', owner: { login: 'acme' } },
    },
    {
      number: 2,
      created_at: '2026-04-01T00:00:00Z',
      security_advisory: { summary: 'Moderate' },
      security_vulnerability: { severity: 'moderate', package: { name: 'lodash', ecosystem: 'npm' } },
      repository: { name: 'gizmos', owner: { login: 'acme' } },
    },
  ]);

  const repos = [
    repoMeta.build({ owner: 'acme', name: 'widgets', dependabotAlertsEnabled: true }),
    repoMeta.build({ owner: 'acme', name: 'gizmos', dependabotAlertsEnabled: true }),
    repoMeta.build({ owner: 'acme', name: 'quiet', dependabotAlertsEnabled: true }),
  ];

  const result = await getOrgCveAlerts(client, 'acme', repos);
  expect(result.isOk()).toBe(true);
  if (result.isOk()) {
    const slices = result.value;
    expect(slices).toHaveLength(3);
    const widgets = slices.find((s) => s.name === 'widgets');
    const quiet = slices.find((s) => s.name === 'quiet');
    if (widgets?.status === 'ok') {
      expect(widgets.alerts).toHaveLength(1);
      expect(widgets.alerts[0]).toMatchObject({ severity: 'critical', packageName: 'left-pad' });
    } else {
      throw new Error('widgets slice should be ok');
    }
    if (quiet?.status === 'ok') {
      expect(quiet.alerts).toEqual([]);
    } else {
      throw new Error('quiet slice should be ok with empty alerts');
    }
  }
});

test('getOrgCveAlerts marks repos with dependabotAlertsEnabled=false as not-enabled', async () => {
  const client = new FakeGithubClient();
  client.onPaginate(ORG_ALERTS, {}).resolves([]);

  const repos = [
    repoMeta.build({ owner: 'acme', name: 'on', dependabotAlertsEnabled: true }),
    repoMeta.build({ owner: 'acme', name: 'off', dependabotAlertsEnabled: false }),
    repoMeta.build({ owner: 'acme', name: 'unknown', dependabotAlertsEnabled: null }),
  ];

  const result = await getOrgCveAlerts(client, 'acme', repos);
  expect(result.isOk()).toBe(true);
  if (result.isOk()) {
    expect(result.value.find((s) => s.name === 'off')).toEqual({ owner: 'acme', name: 'off', status: 'not-enabled' });
    expect(result.value.find((s) => s.name === 'on')).toMatchObject({ status: 'ok', alerts: [] });
    expect(result.value.find((s) => s.name === 'unknown')).toMatchObject({ status: 'ok', alerts: [] });
  }
});

test('getOrgCveAlerts skips alerts whose security_vulnerability is null', async () => {
  const client = new FakeGithubClient();
  client.onPaginate(ORG_ALERTS, {}).resolves([
    {
      number: 9,
      created_at: '2026-03-01T00:00:00Z',
      security_advisory: { summary: 'auto-dismissed' },
      security_vulnerability: null,
      repository: { name: 'widgets', owner: { login: 'acme' } },
    },
  ]);

  const repos = [repoMeta.build({ owner: 'acme', name: 'widgets', dependabotAlertsEnabled: true })];
  const result = await getOrgCveAlerts(client, 'acme', repos);
  expect(result.isOk()).toBe(true);
  if (result.isOk()) {
    const widgets = result.value[0];
    if (widgets?.status === 'ok') expect(widgets.alerts).toEqual([]);
  }
});

test('getOrgCveAlerts propagates scope-missing across all repos', async () => {
  const client = new FakeGithubClient();
  client
    .onPaginate(ORG_ALERTS, {})
    .fails({ kind: 'scope-missing', required: 'security_events', message: 'missing scope' });

  const repos = [repoMeta.build({ owner: 'acme', name: 'a' }), repoMeta.build({ owner: 'acme', name: 'b' })];
  const result = await getOrgCveAlerts(client, 'acme', repos);
  expect(result.isOk()).toBe(true);
  if (result.isOk()) {
    for (const slice of result.value) {
      expect(slice).toMatchObject({ status: 'scope-missing', requiredScope: 'security_events' });
    }
  }
});

test('getOrgCveAlerts propagates unexpected errors instead of swallowing them', async () => {
  const client = new FakeGithubClient();
  client.onPaginate(ORG_ALERTS, {}).fails({ kind: 'http', status: 503, message: 'service unavailable' });

  const repos = [repoMeta.build({ owner: 'acme', name: 'widgets' })];
  const result = await getOrgCveAlerts(client, 'acme', repos);
  expect(result.isErr()).toBe(true);
});

test('getOrgCveAlerts drops alerts for repos outside the provided list', async () => {
  const client = new FakeGithubClient();
  client.onPaginate(ORG_ALERTS, {}).resolves([
    {
      number: 1,
      created_at: '2026-03-01T00:00:00Z',
      security_advisory: { summary: 'Critical RCE' },
      security_vulnerability: { severity: 'critical', package: { name: 'left-pad', ecosystem: 'npm' } },
      repository: { name: 'phantom', owner: { login: 'acme' } },
    },
  ]);

  const repos = [repoMeta.build({ owner: 'acme', name: 'widgets', dependabotAlertsEnabled: true })];
  const result = await getOrgCveAlerts(client, 'acme', repos);
  expect(result.isOk()).toBe(true);
  if (result.isOk()) {
    expect(result.value).toHaveLength(1);
    expect(result.value.find((s) => s.name === 'phantom')).toBeUndefined();
    const widgets = result.value[0];
    if (widgets?.status === 'ok') expect(widgets.alerts).toEqual([]);
  }
});
