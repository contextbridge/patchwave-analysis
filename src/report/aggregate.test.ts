import { expect, test } from 'bun:test';
import {
  branchProtectionSlice,
  collectedData,
  collectionContext,
  cveAlert,
  cveSliceOk,
  dependabotConfigSlice,
  dependabotPr,
  dependabotUpdateEntry,
  repoMeta,
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
  // The 263-day-old PR should fall into the 90+ bucket (90 and 180+ are no longer split).
  const oldBucket = bundle.prBacklog.openAgeBuckets.find((b) => b.label === '90+ days');
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
    cve: [{ owner: 'acme', name: 'widgets', status: 'scope-missing', requiredScope: 'security_events' }],
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

test('keeps all CVE repos by severity for frontend truncation', () => {
  const data = collectedData.build({
    cve: Array.from({ length: 6 }, (_, i) =>
      cveSliceOk.build({
        owner: 'acme',
        name: `repo-${i + 1}`,
        alerts: [
          cveAlert.build({
            owner: 'acme',
            name: `repo-${i + 1}`,
            severity: i === 0 ? 'critical' : 'high',
          }),
        ],
      }),
    ),
  });

  const bundle = aggregate(data);
  expect(bundle.cve.status).toBe('ok');
  if (bundle.cve.status === 'ok') {
    expect(bundle.cve.topReposBySeverity).toHaveLength(6);
    expect(bundle.cve.topReposBySeverity.map((r) => r.repo)).toContain('acme/repo-6');
  }
});

test('aggregates failing check names across open PRs, sorted by frequency', () => {
  const prA = dependabotPr.build({
    state: 'open',
    checks: {
      total: 2,
      success: 0,
      failure: 2,
      pending: 0,
      failedCheckNames: ['test (unit)', 'lint'],
    },
  });
  const prB = dependabotPr.build({
    state: 'open',
    checks: {
      total: 2,
      success: 1,
      failure: 1,
      pending: 0,
      failedCheckNames: ['test (unit)'],
    },
  });
  const prC = dependabotPr.build({
    state: 'open',
    checks: {
      total: 3,
      success: 2,
      failure: 1,
      pending: 0,
      failedCheckNames: ['typecheck', 'typecheck'],
    },
  });

  const bundle = aggregate(collectedData.build({ dependabotPrs: [prA, prB, prC] }));
  expect(bundle.prBacklog.failingCheckBreakdown).toEqual([
    { checkName: 'test (unit)', failingPrCount: 2 },
    { checkName: 'lint', failingPrCount: 1 },
    { checkName: 'typecheck', failingPrCount: 1 },
  ]);
});

test('builds a cost estimate from human merges and reviews, excluding bot merges', () => {
  const data = collectedData.build({
    dependabotPrs: [
      ...Array.from({ length: 100 }, (_, i) =>
        dependabotPr.build({
          number: i + 1,
          state: 'closed',
          merged: true,
          mergedAt: '2026-04-01T00:00:00Z',
          createdAt: '2026-03-30T00:00:00Z',
          mergedBy: i % 2 === 0 ? 'alice' : 'bob',
        }),
      ),
      // Bot-merged PRs cost a human nothing — they must not add to the estimate.
      dependabotPr.build({ number: 201, merged: true, mergedAt: '2026-04-02T00:00:00Z', mergedBy: 'dependabot' }),
      dependabotPr.build({ number: 202, merged: true, mergedAt: '2026-04-02T00:00:00Z', mergedBy: 'github-actions' }),
    ],
  });
  const bundle = aggregate(data);
  expect(bundle.costEstimate.humanMergeCount).toBe(100);
  expect(bundle.costEstimate.humanReviewCount).toBe(0);
  expect(bundle.costEstimate.hourlyRateUsd).toBe(200);
  expect(bundle.costEstimate.minutesPerPr).toBe(12);
  // 100 actions × 12 min × $200/hr / 60 = $4000 in window
  expect(bundle.costEstimate.windowCostUsd).toBe(4000);
  // ~$1,352/month over 90 days (window × 30.44/90)
  expect(bundle.costEstimate.monthlyCostUsd).toBeGreaterThan(1300);
  expect(bundle.costEstimate.monthlyCostUsd).toBeLessThan(1400);
  expect(bundle.costEstimate.annualCostUsd).toBe(bundle.costEstimate.monthlyCostUsd * 12);
  expect(bundle.costEstimate.savingsScenarios.map((s) => s.autoMergeRate)).toEqual([0.5, 0.6, 0.7, 0.8]);
  expect(bundle.costEstimate.savingsScenarios[0]?.annualSavingsUsd).toBe(
    (bundle.costEstimate.savingsScenarios[0]?.monthlySavingsUsd ?? 0) * 12,
  );
});

test('counts a reviewer who also merged the PR once, but credits a review when someone else merged', () => {
  const data = collectedData.build({
    dependabotPrs: [
      // alice reviewed and merged her own PR → counts once, as the merge
      dependabotPr.build({
        number: 1,
        merged: true,
        mergedAt: '2026-04-01T00:00:00Z',
        mergedBy: 'alice',
        reviewers: ['alice'],
      }),
      // alice reviewed, bob merged → both are credited
      dependabotPr.build({
        number: 2,
        merged: true,
        mergedAt: '2026-04-02T00:00:00Z',
        mergedBy: 'bob',
        reviewers: ['alice'],
      }),
      // carol reviewed an auto-merged PR (no human merger) → her review still counts
      dependabotPr.build({
        number: 3,
        merged: true,
        mergedAt: '2026-04-03T00:00:00Z',
        mergedBy: null,
        reviewers: ['carol'],
      }),
    ],
  });
  const bundle = aggregate(data);

  expect(bundle.people.mergers.find((m) => m.login === 'alice')?.count).toBe(1);
  expect(bundle.people.mergers.find((m) => m.login === 'bob')?.count).toBe(1);
  // alice is credited only for PR #2 (bob merged), not her self-merged PR #1
  expect(bundle.people.reviewers.find((r) => r.login === 'alice')?.count).toBe(1);
  expect(bundle.people.reviewers.find((r) => r.login === 'carol')?.count).toBe(1);

  // 2 human merges (alice, bob) + 2 reviews (alice on #2, carol on #3) = 4 actions
  expect(bundle.costEstimate.humanMergeCount).toBe(2);
  expect(bundle.costEstimate.humanReviewCount).toBe(2);
});

test('mergers excludes bot logins and surfaces per-person window cost', () => {
  const data = collectedData.build({
    dependabotPrs: [
      dependabotPr.build({ number: 1, merged: true, mergedAt: '2026-04-01T00:00:00Z', mergedBy: 'alice' }),
      dependabotPr.build({ number: 2, merged: true, mergedAt: '2026-04-02T00:00:00Z', mergedBy: 'alice' }),
      dependabotPr.build({ number: 3, merged: true, mergedAt: '2026-04-03T00:00:00Z', mergedBy: 'github-actions' }),
      dependabotPr.build({ number: 4, merged: true, mergedAt: '2026-04-04T00:00:00Z', mergedBy: 'dependabot' }),
      dependabotPr.build({ number: 5, merged: true, mergedAt: '2026-04-05T00:00:00Z', mergedBy: 'renovate-bot' }),
      dependabotPr.build({ number: 6, merged: true, mergedAt: '2026-04-06T00:00:00Z', mergedBy: 'bob' }),
    ],
  });
  const bundle = aggregate(data);
  expect(bundle.people.mergers.map((m) => m.login)).toEqual(['alice', 'bob']);
  const alice = bundle.people.mergers.find((m) => m.login === 'alice');
  expect(alice?.count).toBe(2);
  expect(alice?.windowCostUsd).toBeGreaterThan(0);
  expect(alice?.annualCostUsd).toBeGreaterThan(alice?.windowCostUsd ?? 0);
});

test('cadenceBreakdown counts update entries by schedule interval', () => {
  const data = collectedData.build({
    dependabotConfig: [
      dependabotConfigSlice.build({
        name: 'a',
        updates: [
          dependabotUpdateEntry.build({ ecosystem: 'npm', interval: 'daily' }),
          dependabotUpdateEntry.build({ ecosystem: 'github-actions', interval: 'weekly' }),
        ],
      }),
      dependabotConfigSlice.build({
        name: 'b',
        updates: [dependabotUpdateEntry.build({ ecosystem: 'npm', interval: 'weekly' })],
      }),
      dependabotConfigSlice.build({
        name: 'c',
        updates: [dependabotUpdateEntry.build({ ecosystem: 'docker', interval: null })],
      }),
    ],
  });
  const bundle = aggregate(data);
  expect(bundle.dependabotCoverage.cadenceBreakdown).toEqual([
    { interval: 'daily', entryCount: 1 },
    { interval: 'weekly', entryCount: 2 },
    { interval: 'unspecified', entryCount: 1 },
  ]);
});

test('reposUsingGroups and reposWithIgnoreRules count repos with any non-zero entry', () => {
  const data = collectedData.build({
    dependabotConfig: [
      dependabotConfigSlice.build({
        name: 'a',
        updates: [dependabotUpdateEntry.build({ groupCount: 2, ignoreCount: 0 })],
      }),
      dependabotConfigSlice.build({
        name: 'b',
        updates: [
          dependabotUpdateEntry.build({ groupCount: 0, ignoreCount: 0 }),
          dependabotUpdateEntry.build({ groupCount: 0, ignoreCount: 3 }),
        ],
      }),
      dependabotConfigSlice.build({
        name: 'c',
        updates: [dependabotUpdateEntry.build({ groupCount: 1, ignoreCount: 1 })],
      }),
    ],
  });
  const bundle = aggregate(data);
  expect(bundle.dependabotCoverage).toMatchObject({
    reposUsingGroups: 2,
    reposWithIgnoreRules: 2,
  });
});

test("reposAtPrCap uses each repo's effective cap from sum of entry limits", () => {
  const fiveOpenPrs = (name: string) =>
    Array.from({ length: 5 }, (_, i) =>
      dependabotPr.build({ name, number: i + 1, state: 'open', createdAt: '2026-05-01T00:00:00Z' }),
    );
  const data = collectedData.build({
    dependabotConfig: [
      // repo with a single default-limit entry — cap is 5; 5 open trips it
      dependabotConfigSlice.build({
        name: 'capped',
        updates: [dependabotUpdateEntry.build({ ecosystem: 'npm', openPullRequestsLimit: 5 })],
      }),
      // repo with a raised limit — cap is 20; 5 open should NOT trip it
      dependabotConfigSlice.build({
        name: 'raised',
        updates: [dependabotUpdateEntry.build({ ecosystem: 'npm', openPullRequestsLimit: 20 })],
      }),
    ],
    dependabotPrs: [...fiveOpenPrs('capped'), ...fiveOpenPrs('raised')],
  });
  const bundle = aggregate(data);
  expect(bundle.stalledSignals.reposAtPrCap).toEqual([{ repo: 'acme/capped', openPrs: 5 }]);
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
