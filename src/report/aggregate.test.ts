import { expect, test } from 'bun:test';
import { collectedData, collectionContext, cveAlert, cveSliceOk, dependabotPr, repoMeta } from '../testFactories.ts';
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

test('averages open PR age and reports null when nothing is open', () => {
  // collectionContext.now is 2026-05-22, so these open PRs are 10 and 30 days old.
  const withOpen = collectedData.build({
    dependabotPrs: [
      dependabotPr.build({ state: 'open', createdAt: '2026-05-12T00:00:00Z' }),
      dependabotPr.build({ state: 'open', createdAt: '2026-04-22T00:00:00Z' }),
    ],
  });
  expect(aggregate(withOpen).prBacklog.openAvgAgeDays).toBe(20);

  const noOpen = collectedData.build({
    dependabotPrs: [dependabotPr.build({ state: 'closed', merged: true, mergedAt: '2026-04-01T00:00:00Z' })],
  });
  expect(aggregate(noOpen).prBacklog.openAvgAgeDays).toBeNull();
});

test('rolls org/visibility/language/security-update counts up into orgOverview', () => {
  const data = collectedData.build({
    repos: [
      repoMeta.build({
        name: 'a',
        visibility: 'public',
        primaryLanguage: 'TypeScript',
        dependabotSecurityUpdates: true,
      }),
      repoMeta.build({
        name: 'b',
        visibility: 'private',
        primaryLanguage: 'JavaScript',
        dependabotSecurityUpdates: true,
      }),
      repoMeta.build({ name: 'c', visibility: 'private', primaryLanguage: 'Go', dependabotSecurityUpdates: false }),
      repoMeta.build({ name: 'd', visibility: 'internal', primaryLanguage: null, archived: true }),
    ],
  });

  const bundle = aggregate(data);
  expect(bundle.orgOverview).toMatchObject({
    repoCount: 3,
    publicCount: 1,
    privateCount: 2,
    archivedExcluded: 1,
    nodeTsRepoCount: 2,
    reposWithSecurityUpdates: 2,
  });
});

test('excludes forks from active repo counts without counting them as archived', () => {
  const data = collectedData.build({
    repos: [
      repoMeta.build({ name: 'a' }),
      repoMeta.build({ name: 'b', fork: true }),
      repoMeta.build({ name: 'c', archived: true }),
    ],
  });

  expect(aggregate(data).orgOverview).toMatchObject({ repoCount: 1, archivedExcluded: 1 });
});

test('topLanguages is a repo-count breakdown using primaryLanguage', () => {
  const data = collectedData.build({
    repos: [
      repoMeta.build({ owner: 'acme', name: 'a', primaryLanguage: 'TypeScript' }),
      repoMeta.build({ owner: 'acme', name: 'b', primaryLanguage: 'TypeScript' }),
      repoMeta.build({ owner: 'acme', name: 'c', primaryLanguage: 'Go' }),
      repoMeta.build({ owner: 'acme', name: 'd', primaryLanguage: null }),
    ],
  });

  const bundle = aggregate(data);
  expect(bundle.orgOverview.topLanguages).toEqual([
    { language: 'TypeScript', repoCount: 2, percentage: 66.7 },
    { language: 'Go', repoCount: 1, percentage: 33.3 },
  ]);
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

test('reposAtPrCap lists repos with at least the default open-PR cap of 5', () => {
  const openPrs = (name: string, count: number) =>
    Array.from({ length: count }, (_, i) =>
      dependabotPr.build({ name, number: i + 1, state: 'open', createdAt: '2026-05-01T00:00:00Z' }),
    );
  const data = collectedData.build({
    dependabotPrs: [...openPrs('capped', 5), ...openPrs('few', 4)],
  });
  const bundle = aggregate(data);
  expect(bundle.stalledSignals.reposAtPrCap).toEqual([{ repo: 'acme/capped', openPrs: 5 }]);
});
