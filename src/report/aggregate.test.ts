import { expect, test } from 'bun:test';
import {
  branchProtectionSlice,
  collectedData,
  collectionContext,
  cveAlert,
  cveSliceOk,
  dependabotConfigSlice,
  dependabotPr,
  repoMeta,
  revertEvent,
} from '../testFactories.ts';
import { instantFromString } from '../time.ts';
import { aggregate } from './aggregate.ts';

test('counts merged-in-window PRs and surfaces backlog age buckets', () => {
  const data = collectedData.build({
    dependabotPrs: [
      dependabotPr.build({
        state: 'closed',
        merged: true,
        mergedAt: '2026-04-01T00:00:00Z',
        createdAt: '2026-03-30T00:00:00Z',
      }),
      dependabotPr.build({
        state: 'open',
        createdAt: '2025-09-01T00:00:00Z',
      }),
    ],
  });

  const bundle = aggregate(data);
  expect(bundle.prBacklog).toMatchObject({
    openCount: 1,
    mergedInWindowCount: 1,
    oldestOpenDays: expect.any(Number) as number,
  });
  // The 263-day-old PR should fall into the 180+ bucket.
  const oldBucket = bundle.prBacklog.openAgeBuckets.find((b) => b.label === '180+ days');
  expect(oldBucket?.count).toBe(1);
});

test('rolls org/visibility/language counts up into orgOverview', () => {
  const data = collectedData.build({
    repos: [
      repoMeta.build({ name: 'a', visibility: 'public', primaryLanguage: 'TypeScript' }),
      repoMeta.build({ name: 'b', visibility: 'private', primaryLanguage: 'JavaScript' }),
      repoMeta.build({ name: 'c', visibility: 'private', primaryLanguage: 'Go' }),
      repoMeta.build({ name: 'd', visibility: 'internal', primaryLanguage: null, archived: true }),
    ],
    branchProtection: [
      branchProtectionSlice.build({ name: 'a', hasProtection: true }),
      branchProtectionSlice.build({ name: 'b', hasProtection: false }),
    ],
  });

  const bundle = aggregate(data);
  expect(bundle.orgOverview).toMatchObject({
    repoCount: 3,
    publicCount: 1,
    privateCount: 2,
    archivedExcluded: 1,
    nodeTsRepoCount: 2,
    reposWithBranchProtection: 1,
  });
});

test('emits a scope-missing CVE exposure when any slice signals scope-missing', () => {
  const data = collectedData.build({
    cve: [{ status: 'scope-missing', requiredScope: 'security_events' }],
  });
  const bundle = aggregate(data);
  expect(bundle.cve).toMatchObject({ status: 'scope-missing', requiredScope: 'security_events' });
});

test('counts CVE alerts by severity and surfaces oldest critical days', () => {
  const data = collectedData.build({
    ctx: collectionContext.build({ now: instantFromString('2026-05-22T00:00:00Z') }),
    cve: [
      cveSliceOk.build({
        alerts: [
          cveAlert.build({ severity: 'critical', createdAt: '2026-01-01T00:00:00Z' }),
          cveAlert.build({ severity: 'high' }),
          cveAlert.build({ severity: 'high' }),
        ],
      }),
    ],
  });
  const bundle = aggregate(data);
  expect(bundle.cve.status).toBe('ok');
  if (bundle.cve.status === 'ok') {
    expect(bundle.cve.bySeverity).toEqual({ critical: 1, high: 2, medium: 0, low: 0 });
    expect(bundle.cve.oldestCriticalDays).toBeGreaterThanOrEqual(141);
  }
});

test('recommends action when more than half of failing CI is mechanical', () => {
  const failing = dependabotPr.build({
    state: 'open',
    checks: {
      total: 1,
      success: 0,
      failure: 1,
      pending: 0,
      failedCheckNames: ['install dependencies', 'lockfile check', 'lockfile integrity'],
    },
  });
  const data = collectedData.build({
    dependabotPrs: [failing, failing, failing, failing],
  });

  const bundle = aggregate(data);
  const high = bundle.recommendations.find((r) => r.priority === 'high');
  expect(high?.message).toContain('lockfile-related');
});

test('recommends investigating a long-standing Critical CVE', () => {
  const data = collectedData.build({
    ctx: collectionContext.build({ now: instantFromString('2026-05-22T00:00:00Z') }),
    cve: [
      cveSliceOk.build({
        alerts: [cveAlert.build({ severity: 'critical', createdAt: '2025-11-01T00:00:00Z' })],
      }),
    ],
  });
  const bundle = aggregate(data);
  const rec = bundle.recommendations.find((r) => r.message.includes('Critical CVE'));
  expect(rec?.priority).toBe('high');
});

test('counts dependabot reverts via dependabotRevertsInWindow', () => {
  const data = collectedData.build({
    reverts: [
      revertEvent.build({ revertsDependabotPr: true }),
      revertEvent.build({ revertsDependabotPr: false }),
      revertEvent.build({ revertsDependabotPr: true }),
    ],
  });
  const bundle = aggregate(data);
  expect(bundle.stalledSignals.revertsInWindow).toBe(3);
  expect(bundle.stalledSignals.dependabotRevertsInWindow).toBe(2);
});

test('dependabotCoverage reflects only the live (non-archived) repos', () => {
  const data = collectedData.build({
    repos: [
      repoMeta.build({ name: 'a', archived: false, dependabotSecurityUpdates: true }),
      repoMeta.build({ name: 'b', archived: false, dependabotSecurityUpdates: false }),
      repoMeta.build({ name: 'c', archived: true, dependabotSecurityUpdates: true }),
    ],
    dependabotConfig: [
      dependabotConfigSlice.build({ name: 'a', hasConfig: true, ecosystems: ['npm'] }),
      dependabotConfigSlice.build({ name: 'b', hasConfig: false, ecosystems: [] }),
    ],
  });
  const bundle = aggregate(data);
  expect(bundle.dependabotCoverage).toMatchObject({
    reposWithConfig: 1,
    reposWithSecurityUpdates: 1,
  });
});
