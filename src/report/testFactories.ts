import { Factory } from 'fishery';
import { instantFromString } from '../time.ts';
import type {
  CostEstimate,
  CveExposure,
  DependabotCoverage,
  OrgOverview,
  People,
  PrBacklog,
  ReportBundle,
  ReportMeta,
  StalledSignals,
} from './aggregate.ts';
import { ASSUMED_HOURLY_RATE_USD, ASSUMED_MIN_PER_PR, deriveCostEstimate, derivePersonCosts } from './costFormulas.ts';
import { type EmbeddedReportData, toEmbeddedShape } from './embeddedShape.ts';
import type { ReportAnalyticsConfig } from './reportAnalyticsConfig.ts';

export const reportMeta = Factory.define<ReportMeta>(() => ({
  org: 'acme',
  windowDays: 90,
  generatedAt: instantFromString('2026-05-22T00:00:00Z'),
  totalReposScanned: 24,
}));

export const orgOverview = Factory.define<OrgOverview>(() => ({
  repoCount: 24,
  publicCount: 3,
  privateCount: 21,
  internalCount: 0,
  archivedExcluded: 1,
  topLanguages: [{ language: 'TypeScript', repoCount: 18, percentage: 100 }],
  nodeTsRepoCount: 18,
  nodeTsRepoPercentage: 75,
  reposWithBranchProtection: 14,
}));

export const dependabotCoverage = Factory.define<DependabotCoverage>(() => ({
  reposWithConfig: 20,
  reposWithConfigPercentage: 83.3,
  reposWithSecurityUpdates: 19,
  reposWithSecurityUpdatesPercentage: 79.2,
  ecosystemBreakdown: [{ ecosystem: 'npm', repoCount: 18 }],
  cadenceBreakdown: [
    { interval: 'weekly', entryCount: 16 },
    { interval: 'daily', entryCount: 4 },
  ],
  reposUsingGroups: 5,
  reposWithIgnoreRules: 3,
}));

export const prBacklog = Factory.define<PrBacklog>(() => ({
  openCount: 102,
  closedInWindowCount: 14,
  mergedInWindowCount: 273,
  openAgeBuckets: [
    { label: '0–30 days', count: 40 },
    { label: '30–60 days', count: 18 },
    { label: '60–90 days', count: 6 },
    { label: '90+ days', count: 38 },
  ],
  oldestOpenDays: 312,
  openAvgAgeDays: 74,
  bumpTypeSplit: [
    { bumpType: 'patch', count: 150, percentage: 55 },
    { bumpType: 'minor', count: 95, percentage: 34.8 },
    { bumpType: 'major', count: 28, percentage: 10.2 },
  ],
  devOnlyShare: { count: 80, percentage: 29.3 },
  ciStatusMix: { green: 50, failing: 30, pending: 22 },
  failingCheckBreakdown: [],
  timeToMergeP50Days: 2,
  timeToMergeP90Days: 14,
}));

export const stalledSignals = Factory.define<StalledSignals>(() => ({
  reposAtPrCap: [{ repo: 'acme/api', openPrs: 7 }],
  reposWithConfigButNoRecentPrs: ['acme/old-tool'],
}));

// Cost figures derive from the real defaults and formulas so the fixtures track
// production whenever the assumptions move, rather than restating stale literals.
const COST_WINDOW_DAYS = 90;
const HUMAN_MERGE_COUNT = 150;
const HUMAN_REVIEW_COUNT = 12;

export const people = Factory.define<People>(() => ({
  mergers: derivePersonCosts(
    [
      { login: 'alice', count: 90 },
      { login: 'bob', count: 60 },
    ],
    COST_WINDOW_DAYS,
    ASSUMED_MIN_PER_PR,
    ASSUMED_HOURLY_RATE_USD,
  ),
  reviewers: derivePersonCosts(
    [{ login: 'alice', count: 12 }],
    COST_WINDOW_DAYS,
    ASSUMED_MIN_PER_PR,
    ASSUMED_HOURLY_RATE_USD,
  ),
  commenters: [],
}));

export const costEstimate = Factory.define<CostEstimate>(() => ({
  humanMergeCount: HUMAN_MERGE_COUNT,
  humanReviewCount: HUMAN_REVIEW_COUNT,
  openCount: 102,
  windowDays: COST_WINDOW_DAYS,
  hourlyRateUsd: ASSUMED_HOURLY_RATE_USD,
  minutesPerPr: ASSUMED_MIN_PER_PR,
  ...deriveCostEstimate(HUMAN_MERGE_COUNT + HUMAN_REVIEW_COUNT, COST_WINDOW_DAYS, {
    hourlyRateUsd: ASSUMED_HOURLY_RATE_USD,
    minutesPerPr: ASSUMED_MIN_PER_PR,
  }),
}));

export const cveExposureOk = Factory.define<CveExposure>(() => ({
  status: 'ok',
  totalOpenAlerts: 7,
  bySeverity: { critical: 1, high: 3, medium: 2, low: 1 },
  topReposBySeverity: [{ repo: 'acme/api', critical: 1, high: 2, medium: 1, low: 0 }],
  oldestCriticalDays: 95,
  oldestHighDays: 200,
  reposWithSecurityAlertsDisabled: [],
}));

export const cveExposureScopeMissing = Factory.define<CveExposure>(() => ({
  status: 'scope-missing',
  requiredScope: 'security_events',
  totalOpenAlerts: 0,
  bySeverity: { critical: 0, high: 0, medium: 0, low: 0 },
  topReposBySeverity: [],
  oldestCriticalDays: null,
  oldestHighDays: null,
  reposWithSecurityAlertsDisabled: [],
}));

export const reportBundle = Factory.define<ReportBundle>(() => ({
  meta: reportMeta.build(),
  orgOverview: orgOverview.build(),
  dependabotCoverage: dependabotCoverage.build(),
  prBacklog: prBacklog.build(),
  stalledSignals: stalledSignals.build(),
  people: people.build(),
  costEstimate: costEstimate.build(),
  cve: cveExposureOk.build(),
}));

// The web report (App, dev server) consumes the bundle in its embedded shape,
// with `generatedAt` serialized to a string.
export const embeddedReportData = Factory.define<EmbeddedReportData>(() => toEmbeddedShape(reportBundle.build()));

export const reportAnalyticsConfig = Factory.define<ReportAnalyticsConfig>(() => ({
  telemetryDisabled: false,
  reportId: 'report-1234',
  generatedByAnonId: 'anon-5678',
  version: '0.0.1',
}));
