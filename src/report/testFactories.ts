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
  topLanguages: [{ language: 'TypeScript', bytes: 2_000_000, percentage: 65 }],
  nodeTsRepoCount: 18,
  nodeTsRepoPercentage: 75,
  activeHumanCommitters: 17,
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
    { label: '90–180 days', count: 25 },
    { label: '180+ days', count: 13 },
  ],
  oldestOpenDays: 312,
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

export const people = Factory.define<People>(() => ({
  topMergers: [
    { login: 'alice', count: 90, windowCostUsd: 1125, annualCostUsd: 4563 },
    { login: 'bob', count: 60, windowCostUsd: 750, annualCostUsd: 3042 },
  ],
  topReviewers: [{ login: 'alice', count: 12, windowCostUsd: 90, annualCostUsd: 365 }],
  topCommenters: [],
}));

export const costEstimate = Factory.define<CostEstimate>(() => ({
  mergedInWindow: 273,
  openCount: 102,
  windowDays: 90,
  hourlyRateUsd: 150,
  minutesPerPr: 5,
  windowCostUsd: 3413,
  monthlyCostUsd: 1154,
  annualCostUsd: 13848,
  savingsScenarios: [
    { autoMergeRate: 0.5, monthlySavingsUsd: 577, annualSavingsUsd: 6924 },
    { autoMergeRate: 0.6, monthlySavingsUsd: 692, annualSavingsUsd: 8304 },
    { autoMergeRate: 0.7, monthlySavingsUsd: 808, annualSavingsUsd: 9696 },
    { autoMergeRate: 0.8, monthlySavingsUsd: 923, annualSavingsUsd: 11076 },
  ],
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
