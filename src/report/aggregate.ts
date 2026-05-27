import { classifyBumpType, isDevDependencyBump } from '../heuristics/bumpType.ts';
import { type Instant, Temporal, instantFromString } from '../time.ts';
import type {
  CollectedData,
  CveAlert,
  CveSeverity,
  DependabotConfigSlice,
  DependabotPr,
  LanguageBytes,
} from '../types.ts';
import { ASSUMED_HOURLY_RATE_USD, ASSUMED_MIN_PER_PR, deriveCostEstimate, derivePersonCosts } from './costFormulas.ts';

export interface ReportBundle {
  meta: ReportMeta;
  orgOverview: OrgOverview;
  dependabotCoverage: DependabotCoverage;
  prBacklog: PrBacklog;
  stalledSignals: StalledSignals;
  people: People;
  costEstimate: CostEstimate;
  cve: CveExposure;
}

export interface ReportMeta {
  org: string;
  windowDays: number;
  generatedAt: Instant;
  totalReposScanned: number;
}

export interface OrgOverview {
  repoCount: number;
  publicCount: number;
  privateCount: number;
  internalCount: number;
  archivedExcluded: number;
  topLanguages: Array<{ language: string; bytes: number; percentage: number }>;
  nodeTsRepoCount: number;
  nodeTsRepoPercentage: number;
  activeHumanCommitters: number;
  reposWithBranchProtection: number;
}

export type CadenceLabel = 'daily' | 'weekly' | 'monthly' | 'unspecified';

export interface DependabotCoverage {
  reposWithConfig: number;
  reposWithConfigPercentage: number;
  reposWithSecurityUpdates: number;
  reposWithSecurityUpdatesPercentage: number;
  ecosystemBreakdown: Array<{ ecosystem: string; repoCount: number }>;
  cadenceBreakdown: Array<{ interval: CadenceLabel; entryCount: number }>;
  reposUsingGroups: number;
  reposWithIgnoreRules: number;
}

export interface PrBacklog {
  openCount: number;
  closedInWindowCount: number;
  mergedInWindowCount: number;
  openAgeBuckets: Array<{ label: string; count: number }>;
  oldestOpenDays: number | null;
  openAvgAgeDays: number | null;
  bumpTypeSplit: Array<{ bumpType: string; count: number; percentage: number }>;
  devOnlyShare: { count: number; percentage: number };
  ciStatusMix: { green: number; failing: number; pending: number };
  failingCheckBreakdown: Array<{ checkName: string; failingPrCount: number }>;
  timeToMergeP50Days: number | null;
  timeToMergeP90Days: number | null;
}

export interface StalledSignals {
  reposAtPrCap: Array<{ repo: string; openPrs: number }>;
  reposWithConfigButNoRecentPrs: string[];
}

export interface People {
  mergers: Array<{ login: string; count: number; windowCostUsd: number; annualCostUsd: number }>;
  reviewers: Array<{ login: string; count: number; windowCostUsd: number; annualCostUsd: number }>;
  commenters: Array<{ login: string; count: number }>;
}

export interface CostEstimate {
  humanMergeCount: number;
  humanReviewCount: number;
  openCount: number;
  windowDays: number;
  hourlyRateUsd: number;
  minutesPerPr: number;
  windowCostUsd: number;
  monthlyCostUsd: number;
  annualCostUsd: number;
  savingsScenarios: Array<{ autoMergeRate: number; monthlySavingsUsd: number; annualSavingsUsd: number }>;
}

export interface CveExposure {
  status: 'ok' | 'scope-missing';
  requiredScope?: string;
  totalOpenAlerts: number;
  bySeverity: Record<CveSeverity, number>;
  topReposBySeverity: Array<{ repo: string; critical: number; high: number; medium: number; low: number }>;
  oldestCriticalDays: number | null;
  oldestHighDays: number | null;
  reposWithSecurityAlertsDisabled: string[];
}

const DEFAULT_PR_CAP = 5;

export function aggregate(data: CollectedData): ReportBundle {
  const now = data.ctx.now;
  const windowStart = data.ctx.windowStart;
  const meta: ReportMeta = {
    org: data.ctx.org,
    windowDays: data.ctx.windowDays,
    generatedAt: now,
    totalReposScanned: data.repos.length,
  };

  const orgOverview = buildOrgOverview(data);
  const dependabotCoverage = buildDependabotCoverage(data);
  const prBacklog = buildPrBacklog(data, now, windowStart);
  const stalledSignals = buildStalledSignals(data, windowStart);
  const people = buildPeople(data, data.ctx.windowDays);
  const costEstimate = buildCostEstimate(people, prBacklog.openCount, data.ctx.windowDays);
  const cve = buildCveExposure(data, now);

  return {
    meta,
    orgOverview,
    dependabotCoverage,
    prBacklog,
    stalledSignals,
    people,
    costEstimate,
    cve,
  };
}

function buildOrgOverview(data: CollectedData): OrgOverview {
  const repos = data.repos.filter((r) => !r.archived);
  const archivedExcluded = data.repos.length - repos.length;
  const publicCount = repos.filter((r) => r.visibility === 'public').length;
  const privateCount = repos.filter((r) => r.visibility === 'private').length;
  const internalCount = repos.filter((r) => r.visibility === 'internal').length;

  const aggregateBytes: LanguageBytes = {};
  for (const lang of data.languages) {
    for (const [name, bytes] of Object.entries(lang.bytes)) {
      aggregateBytes[name] = (aggregateBytes[name] ?? 0) + bytes;
    }
  }
  const totalBytes = Object.values(aggregateBytes).reduce((a, b) => a + b, 0);
  const topLanguages = Object.entries(aggregateBytes)
    .map(([language, bytes]) => ({
      language,
      bytes,
      percentage: totalBytes > 0 ? round1((bytes / totalBytes) * 100) : 0,
    }))
    .sort((a, b) => b.bytes - a.bytes)
    .slice(0, 10);

  const nodeTsRepoCount = repos.filter(
    (r) => r.primaryLanguage === 'TypeScript' || r.primaryLanguage === 'JavaScript',
  ).length;

  const allCommitters = new Set<string>();
  for (const slice of data.contributors) {
    for (const login of slice.activeHumanLogins) allCommitters.add(login);
  }

  const reposWithBranchProtection = data.branchProtection.filter((b) => b.hasProtection).length;

  return {
    repoCount: repos.length,
    publicCount,
    privateCount,
    internalCount,
    archivedExcluded,
    topLanguages,
    nodeTsRepoCount,
    nodeTsRepoPercentage: pct(nodeTsRepoCount, repos.length),
    activeHumanCommitters: allCommitters.size,
    reposWithBranchProtection,
  };
}

function buildDependabotCoverage(data: CollectedData): DependabotCoverage {
  const liveRepos = data.repos.filter((r) => !r.archived);
  const reposWithConfig = data.dependabotConfig.filter((c) => c.hasConfig).length;
  const reposWithSecurity = liveRepos.filter((r) => r.dependabotSecurityUpdates === true).length;

  const ecoCounts = new Map<string, number>();
  for (const cfg of data.dependabotConfig) {
    for (const eco of cfg.ecosystems) {
      ecoCounts.set(eco, (ecoCounts.get(eco) ?? 0) + 1);
    }
  }
  const ecosystemBreakdown = [...ecoCounts.entries()]
    .map(([ecosystem, repoCount]) => ({ ecosystem, repoCount }))
    .sort((a, b) => b.repoCount - a.repoCount);

  const cadenceCounts: Record<CadenceLabel, number> = { daily: 0, weekly: 0, monthly: 0, unspecified: 0 };
  let reposUsingGroups = 0;
  let reposWithIgnoreRules = 0;
  for (const cfg of data.dependabotConfig) {
    for (const update of cfg.updates) {
      cadenceCounts[update.interval ?? 'unspecified'] += 1;
    }
    if (cfg.updates.some((u) => u.groupCount > 0)) reposUsingGroups += 1;
    if (cfg.updates.some((u) => u.ignoreCount > 0)) reposWithIgnoreRules += 1;
  }
  const cadenceOrder: CadenceLabel[] = ['daily', 'weekly', 'monthly', 'unspecified'];
  const cadenceBreakdown = cadenceOrder
    .map((interval) => ({ interval, entryCount: cadenceCounts[interval] }))
    .filter((c) => c.entryCount > 0);

  return {
    reposWithConfig,
    reposWithConfigPercentage: pct(reposWithConfig, liveRepos.length),
    reposWithSecurityUpdates: reposWithSecurity,
    reposWithSecurityUpdatesPercentage: pct(reposWithSecurity, liveRepos.length),
    ecosystemBreakdown,
    cadenceBreakdown,
    reposUsingGroups,
    reposWithIgnoreRules,
  };
}

function buildPrBacklog(data: CollectedData, now: Instant, windowStart: Instant): PrBacklog {
  const prs = data.dependabotPrs;
  const openPrs = prs.filter((p) => p.state === 'open');
  const mergedInWindow = prs.filter((p) => p.merged && p.mergedAt && isAtOrAfter(p.mergedAt, windowStart));
  const closedNotMergedInWindow = prs.filter((p) => !p.merged && p.closedAt && isAtOrAfter(p.closedAt, windowStart));

  const buckets = [
    { label: '0–30 days', min: 0, max: 30 },
    { label: '30–60 days', min: 30, max: 60 },
    { label: '60–90 days', min: 60, max: 90 },
    { label: '90+ days', min: 90, max: Number.POSITIVE_INFINITY },
  ];
  const openAges = openPrs.map((p) => daysBetween(now, instantFromString(p.createdAt)));
  const openAgeBuckets = buckets.map((b) => ({
    label: b.label,
    count: openAges.filter((age) => age >= b.min && age < b.max).length,
  }));

  const oldestOpenDays = openAges.length === 0 ? null : Math.max(...openAges);
  const openAvgAgeDays =
    openAges.length === 0 ? null : Math.round(openAges.reduce((sum, age) => sum + age, 0) / openAges.length);

  const bumpCounts = new Map<string, number>();
  for (const pr of prs) {
    const t = classifyBumpType(pr.title);
    bumpCounts.set(t, (bumpCounts.get(t) ?? 0) + 1);
  }
  const bumpTotal = [...bumpCounts.values()].reduce((a, b) => a + b, 0);
  const bumpTypeSplit = [...bumpCounts.entries()]
    .map(([bumpType, count]) => ({ bumpType, count, percentage: pct(count, bumpTotal) }))
    .sort((a, b) => b.count - a.count);

  const devOnlyCount = prs.filter((p) => isDevDependencyBump(p.title)).length;
  const devOnlyShare = { count: devOnlyCount, percentage: pct(devOnlyCount, prs.length) };

  let green = 0;
  let failing = 0;
  let pending = 0;
  const failingPrCountByCheck = new Map<string, number>();
  for (const pr of openPrs) {
    if (pr.checks.total === 0) {
      pending += 1;
      continue;
    }
    if (pr.checks.failure > 0) {
      failing += 1;
      const uniqueNames = new Set(pr.checks.failedCheckNames);
      for (const name of uniqueNames) {
        failingPrCountByCheck.set(name, (failingPrCountByCheck.get(name) ?? 0) + 1);
      }
    } else if (pr.checks.pending > 0) {
      pending += 1;
    } else {
      green += 1;
    }
  }
  const failingCheckBreakdown = [...failingPrCountByCheck.entries()]
    .map(([checkName, failingPrCount]) => ({ checkName, failingPrCount }))
    .sort((a, b) => b.failingPrCount - a.failingPrCount || a.checkName.localeCompare(b.checkName));

  const ttMergeDays: number[] = mergedInWindow
    .filter((p) => p.mergedAt !== null)
    .map((p) => daysBetween(instantFromString(p.mergedAt as string), instantFromString(p.createdAt)));
  ttMergeDays.sort((a, b) => a - b);
  const timeToMergeP50Days = percentile(ttMergeDays, 50);
  const timeToMergeP90Days = percentile(ttMergeDays, 90);

  return {
    openCount: openPrs.length,
    closedInWindowCount: closedNotMergedInWindow.length,
    mergedInWindowCount: mergedInWindow.length,
    openAgeBuckets,
    oldestOpenDays,
    openAvgAgeDays,
    bumpTypeSplit,
    devOnlyShare,
    ciStatusMix: { green, failing, pending },
    failingCheckBreakdown,
    timeToMergeP50Days,
    timeToMergeP90Days,
  };
}

function buildStalledSignals(data: CollectedData, windowStart: Instant): StalledSignals {
  const openByRepo = new Map<string, DependabotPr[]>();
  for (const pr of data.dependabotPrs) {
    if (pr.state !== 'open') continue;
    const key = `${pr.owner}/${pr.name}`;
    const list = openByRepo.get(key) ?? [];
    list.push(pr);
    openByRepo.set(key, list);
  }
  const configByRepo = new Map<string, DependabotConfigSlice>();
  for (const cfg of data.dependabotConfig) {
    configByRepo.set(`${cfg.owner}/${cfg.name}`, cfg);
  }
  const reposAtPrCap = [...openByRepo.entries()]
    .filter(([repo, list]) => list.length >= effectivePrCap(configByRepo.get(repo)))
    .map(([repo, list]) => ({ repo, openPrs: list.length }))
    .sort((a, b) => b.openPrs - a.openPrs);

  const repoToRecentPrs = new Map<string, number>();
  for (const pr of data.dependabotPrs) {
    if (!isAtOrAfter(pr.createdAt, windowStart)) continue;
    const key = `${pr.owner}/${pr.name}`;
    repoToRecentPrs.set(key, (repoToRecentPrs.get(key) ?? 0) + 1);
  }
  const reposWithConfigButNoRecentPrs = data.dependabotConfig
    .filter((c) => c.hasConfig)
    .filter((c) => (repoToRecentPrs.get(`${c.owner}/${c.name}`) ?? 0) === 0)
    .map((c) => `${c.owner}/${c.name}`)
    .sort();

  return {
    reposAtPrCap,
    reposWithConfigButNoRecentPrs,
  };
}

function buildPeople(data: CollectedData, windowDays: number): People {
  const mergerCounts = new Map<string, number>();
  const reviewerCounts = new Map<string, number>();
  const commenterCounts = new Map<string, number>();
  for (const pr of data.dependabotPrs) {
    if (pr.mergedBy && !isBotLogin(pr.mergedBy)) {
      mergerCounts.set(pr.mergedBy, (mergerCounts.get(pr.mergedBy) ?? 0) + 1);
    }
    for (const r of pr.reviewers) {
      // A reviewer who also merged this PR is counted once, as the merger — don't
      // double-charge the same person for one PR. Two charges only when someone else merged.
      if (isBotLogin(r) || r === pr.mergedBy) continue;
      reviewerCounts.set(r, (reviewerCounts.get(r) ?? 0) + 1);
    }
    for (const c of pr.commenters) if (!isBotLogin(c)) commenterCounts.set(c, (commenterCounts.get(c) ?? 0) + 1);
  }
  const rankedCounts = (m: Map<string, number>) =>
    [...m.entries()].map(([login, count]) => ({ login, count })).sort((a, b) => b.count - a.count);
  const personCosts = (m: Map<string, number>) =>
    derivePersonCosts(rankedCounts(m), windowDays, ASSUMED_MIN_PER_PR, ASSUMED_HOURLY_RATE_USD);

  return {
    mergers: personCosts(mergerCounts),
    reviewers: personCosts(reviewerCounts),
    commenters: rankedCounts(commenterCounts),
  };
}

// Cost reflects human work only: a human merging a PR, plus each human who reviewed a PR
// they did not merge. Bot/auto-merged PRs contribute nothing. By summing the same per-person
// counts the People table shows, the headline equals the sum of that table by construction.
function buildCostEstimate(people: People, openCount: number, windowDays: number): CostEstimate {
  const humanMergeCount = people.mergers.reduce((sum, m) => sum + m.count, 0);
  const humanReviewCount = people.reviewers.reduce((sum, r) => sum + r.count, 0);
  const derived = deriveCostEstimate(humanMergeCount + humanReviewCount, windowDays, {
    hourlyRateUsd: ASSUMED_HOURLY_RATE_USD,
    minutesPerPr: ASSUMED_MIN_PER_PR,
  });
  return {
    humanMergeCount,
    humanReviewCount,
    openCount,
    windowDays,
    hourlyRateUsd: ASSUMED_HOURLY_RATE_USD,
    minutesPerPr: ASSUMED_MIN_PER_PR,
    ...derived,
  };
}

const BOT_LOGIN_RE = /(\[bot\]$|^dependabot$|^github-actions$|-bot$|^copilot$|^renovate$)/i;

export function isBotLogin(login: string): boolean {
  return BOT_LOGIN_RE.test(login);
}

function buildCveExposure(data: CollectedData, now: Instant): CveExposure {
  const scopeMissing = data.cve.find((s) => s.status === 'scope-missing');
  if (scopeMissing && scopeMissing.status === 'scope-missing') {
    return {
      status: 'scope-missing',
      requiredScope: scopeMissing.requiredScope,
      totalOpenAlerts: 0,
      bySeverity: { critical: 0, high: 0, medium: 0, low: 0 },
      topReposBySeverity: [],
      oldestCriticalDays: null,
      oldestHighDays: null,
      reposWithSecurityAlertsDisabled: [],
    };
  }

  const okSlices = data.cve.filter((s) => s.status === 'ok');
  const disabledRepos = data.cve.filter((s) => s.status === 'not-enabled').map((s) => `${s.owner}/${s.name}`);
  const allAlerts: CveAlert[] = okSlices.flatMap((s) => (s.status === 'ok' ? s.alerts : []));
  const bySeverity: Record<CveSeverity, number> = { critical: 0, high: 0, medium: 0, low: 0 };
  for (const a of allAlerts) bySeverity[a.severity] += 1;

  const byRepo = new Map<string, Record<CveSeverity, number>>();
  for (const a of allAlerts) {
    const key = `${a.owner}/${a.name}`;
    let rec = byRepo.get(key);
    if (!rec) {
      rec = { critical: 0, high: 0, medium: 0, low: 0 };
      byRepo.set(key, rec);
    }
    rec[a.severity] += 1;
  }
  const topReposBySeverity = [...byRepo.entries()]
    .map(([repo, counts]) => ({ repo, ...counts }))
    .sort((a, b) => severityScore(b) - severityScore(a));

  const oldest = (sev: CveSeverity): number | null => {
    const filtered = allAlerts.filter((a) => a.severity === sev);
    if (filtered.length === 0) return null;
    return Math.max(...filtered.map((a) => daysBetween(now, instantFromString(a.createdAt))));
  };

  return {
    status: 'ok',
    totalOpenAlerts: allAlerts.length,
    bySeverity,
    topReposBySeverity,
    oldestCriticalDays: oldest('critical'),
    oldestHighDays: oldest('high'),
    reposWithSecurityAlertsDisabled: disabledRepos,
  };
}

function severityScore(rec: { critical: number; high: number; medium: number; low: number }): number {
  return rec.critical * 1000 + rec.high * 100 + rec.medium * 10 + rec.low;
}

function effectivePrCap(config: DependabotConfigSlice | undefined): number {
  if (!config || config.updates.length === 0) return DEFAULT_PR_CAP;
  return config.updates.reduce((sum, u) => sum + u.openPullRequestsLimit, 0);
}

function pct(numerator: number, denominator: number): number {
  if (denominator === 0) return 0;
  return round1((numerator / denominator) * 100);
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function daysBetween(later: Instant, earlier: Instant): number {
  return Math.max(0, Math.floor((later.epochMilliseconds - earlier.epochMilliseconds) / 86_400_000));
}

function isAtOrAfter(iso: string, target: Instant): boolean {
  return Temporal.Instant.compare(instantFromString(iso), target) >= 0;
}

function percentile(sorted: readonly number[], p: number): number | null {
  if (sorted.length === 0) return null;
  const rank = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, Math.min(rank, sorted.length - 1))] ?? null;
}
