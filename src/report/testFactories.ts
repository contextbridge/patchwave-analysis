import { Factory } from 'fishery';
import { instantFromString } from '../time.ts';
import type {
  CveExposure,
  DependabotCoverage,
  OrgOverview,
  People,
  PrBacklog,
  Recommendation,
  ReportBundle,
  ReportMeta,
  StalledSignals,
  ToilCost,
} from './aggregate.ts';

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
  packageManagerSplit: [
    { manager: 'pnpm', repoCount: 12 },
    { manager: 'yarn', repoCount: 6 },
  ],
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
  mechanicalFailureShare: { mechanical: 12, nonMechanical: 18, percentage: 40 },
  timeToMergeP50Days: 2,
  timeToMergeP90Days: 14,
}));

export const stalledSignals = Factory.define<StalledSignals>(() => ({
  reposAtPrCap: [{ repo: 'acme/api', openPrs: 7 }],
  reposWithConfigButNoRecentPrs: ['acme/old-tool'],
  revertsInWindow: 4,
  dependabotRevertsInWindow: 1,
  siblingBumps: [],
}));

export const people = Factory.define<People>(() => ({
  topMergers: [
    { login: 'alice', count: 90 },
    { login: 'bob', count: 60 },
  ],
  topReviewers: [{ login: 'alice', count: 12 }],
  topCommenters: [],
  autoMergeInUse: false,
  autoMergePrCount: 0,
}));

export const toilCost = Factory.define<ToilCost>(() => ({
  mergedInWindow: 273,
  openOver30Days: 62,
  estimatedEngineerMinutesInWindow: 881,
  estimatedEngineerHoursPerWeek: 1.1,
  estimatedWeeklyCostUsd: 165,
  assumptions: { minutesPerMergedPr: 3, idleMinutesPerStalePr: 1, hourlyRateUsd: 150 },
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

export const recommendation = Factory.define<Recommendation>(() => ({
  priority: 'high',
  message: 'Sample high-priority recommendation.',
}));

export const reportBundle = Factory.define<ReportBundle>(() => ({
  meta: reportMeta.build(),
  orgOverview: orgOverview.build(),
  dependabotCoverage: dependabotCoverage.build(),
  prBacklog: prBacklog.build(),
  stalledSignals: stalledSignals.build(),
  people: people.build(),
  toilCost: toilCost.build(),
  cve: cveExposureOk.build(),
  recommendations: [recommendation.build()],
}));
