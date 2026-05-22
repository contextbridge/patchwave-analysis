import { classifyBumpType, isDevDependencyBump } from '../heuristics/bumpType.ts';
import { type Instant, Temporal, instantFromString } from '../time.ts';
import type { CollectedData, CveAlert, CveSeverity, DependabotPr, LanguageBytes } from '../types.ts';

export interface ReportBundle {
  meta: ReportMeta;
  orgOverview: OrgOverview;
  dependabotCoverage: DependabotCoverage;
  prBacklog: PrBacklog;
  stalledSignals: StalledSignals;
  people: People;
  toilCost: ToilCost;
  cve: CveExposure;
  recommendations: Recommendation[];
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

export interface DependabotCoverage {
  reposWithConfig: number;
  reposWithConfigPercentage: number;
  reposWithSecurityUpdates: number;
  reposWithSecurityUpdatesPercentage: number;
  ecosystemBreakdown: Array<{ ecosystem: string; repoCount: number }>;
  packageManagerSplit: Array<{ manager: string; repoCount: number }>;
}

export interface PrBacklog {
  openCount: number;
  closedInWindowCount: number;
  mergedInWindowCount: number;
  openAgeBuckets: Array<{ label: string; count: number }>;
  oldestOpenDays: number | null;
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
  revertsInWindow: number;
  dependabotRevertsInWindow: number;
}

export interface People {
  topMergers: Array<{ login: string; count: number }>;
  topReviewers: Array<{ login: string; count: number }>;
  topCommenters: Array<{ login: string; count: number }>;
  autoMergeInUse: boolean;
  autoMergePrCount: number;
}

export interface ToilCost {
  mergedInWindow: number;
  openOver30Days: number;
  estimatedEngineerMinutesInWindow: number;
  estimatedEngineerHoursPerWeek: number;
  estimatedWeeklyCostUsd: number;
  assumptions: { minutesPerMergedPr: number; idleMinutesPerStalePr: number; hourlyRateUsd: number };
}

export interface CveExposure {
  status: 'ok' | 'scope-missing' | 'no-data';
  requiredScope?: string;
  totalOpenAlerts: number;
  bySeverity: Record<CveSeverity, number>;
  topReposBySeverity: Array<{ repo: string; critical: number; high: number; medium: number; low: number }>;
  oldestCriticalDays: number | null;
  oldestHighDays: number | null;
  reposWithSecurityAlertsDisabled: string[];
}

export interface Recommendation {
  priority: 'high' | 'medium' | 'low';
  message: string;
}

const PR_CAP_THRESHOLD = 5;

export interface AggregateOptions {
  minutesPerMergedPr?: number;
  idleMinutesPerStalePr?: number;
  hourlyRateUsd?: number;
}

export function aggregate(data: CollectedData, options: AggregateOptions = {}): ReportBundle {
  const { minutesPerMergedPr = 3, idleMinutesPerStalePr = 1, hourlyRateUsd = 150 } = options;

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
  const people = buildPeople(data);
  const toilCost = buildToilCost(
    prBacklog,
    data.ctx.windowDays,
    minutesPerMergedPr,
    idleMinutesPerStalePr,
    hourlyRateUsd,
  );
  const cve = buildCveExposure(data, now);
  const recommendations = buildRecommendations({
    prBacklog,
    stalledSignals,
    cve,
    dependabotCoverage,
    orgOverview,
  });

  return {
    meta,
    orgOverview,
    dependabotCoverage,
    prBacklog,
    stalledSignals,
    people,
    toilCost,
    cve,
    recommendations,
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

  const pmCounts = new Map<string, number>();
  for (const cfg of data.dependabotConfig) {
    if (!cfg.packageManager) continue;
    pmCounts.set(cfg.packageManager, (pmCounts.get(cfg.packageManager) ?? 0) + 1);
  }
  const packageManagerSplit = [...pmCounts.entries()]
    .map(([manager, repoCount]) => ({ manager, repoCount }))
    .sort((a, b) => b.repoCount - a.repoCount);

  return {
    reposWithConfig,
    reposWithConfigPercentage: pct(reposWithConfig, liveRepos.length),
    reposWithSecurityUpdates: reposWithSecurity,
    reposWithSecurityUpdatesPercentage: pct(reposWithSecurity, liveRepos.length),
    ecosystemBreakdown,
    packageManagerSplit,
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
    { label: '90–180 days', min: 90, max: 180 },
    { label: '180+ days', min: 180, max: Number.POSITIVE_INFINITY },
  ];
  const openAgeBuckets = buckets.map((b) => ({
    label: b.label,
    count: openPrs.filter((p) => {
      const age = daysBetween(now, instantFromString(p.createdAt));
      return age >= b.min && age < b.max;
    }).length,
  }));

  const oldestOpenDays =
    openPrs.length === 0 ? null : Math.max(...openPrs.map((p) => daysBetween(now, instantFromString(p.createdAt))));

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
  const reposAtPrCap = [...openByRepo.entries()]
    .filter(([, list]) => list.length >= PR_CAP_THRESHOLD)
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

  const revertsInWindow = data.reverts.length;
  const dependabotRevertsInWindow = data.reverts.filter((r) => r.revertsDependabotPr).length;

  return {
    reposAtPrCap,
    reposWithConfigButNoRecentPrs,
    revertsInWindow,
    dependabotRevertsInWindow,
  };
}

function buildPeople(data: CollectedData): People {
  const mergerCounts = new Map<string, number>();
  const reviewerCounts = new Map<string, number>();
  const commenterCounts = new Map<string, number>();
  let autoMergePrCount = 0;
  for (const pr of data.dependabotPrs) {
    if (pr.mergedBy) mergerCounts.set(pr.mergedBy, (mergerCounts.get(pr.mergedBy) ?? 0) + 1);
    for (const r of pr.reviewers) reviewerCounts.set(r, (reviewerCounts.get(r) ?? 0) + 1);
    for (const c of pr.commenters) commenterCounts.set(c, (commenterCounts.get(c) ?? 0) + 1);
    if (pr.autoMergeEnabled) autoMergePrCount += 1;
  }
  const top = (m: Map<string, number>) =>
    [...m.entries()]
      .map(([login, count]) => ({ login, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

  return {
    topMergers: top(mergerCounts),
    topReviewers: top(reviewerCounts),
    topCommenters: top(commenterCounts),
    autoMergeInUse: autoMergePrCount > 0,
    autoMergePrCount,
  };
}

function buildToilCost(
  prBacklog: PrBacklog,
  windowDays: number,
  minutesPerMergedPr: number,
  idleMinutesPerStalePr: number,
  hourlyRateUsd: number,
): ToilCost {
  const openOver30Days = prBacklog.openAgeBuckets
    .filter((b) => b.label !== '0–30 days')
    .reduce((sum, b) => sum + b.count, 0);
  const minutes = prBacklog.mergedInWindowCount * minutesPerMergedPr + openOver30Days * idleMinutesPerStalePr;
  const weeks = Math.max(1, windowDays / 7);
  const hoursPerWeek = round1(minutes / 60 / weeks);
  const weeklyCost = Math.round(hoursPerWeek * hourlyRateUsd);
  return {
    mergedInWindow: prBacklog.mergedInWindowCount,
    openOver30Days,
    estimatedEngineerMinutesInWindow: minutes,
    estimatedEngineerHoursPerWeek: hoursPerWeek,
    estimatedWeeklyCostUsd: weeklyCost,
    assumptions: { minutesPerMergedPr, idleMinutesPerStalePr, hourlyRateUsd },
  };
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

  const okSlices = data.cve.filter((s): s is { status: 'ok'; alerts: CveAlert[] } => s.status === 'ok');
  const disabledRepos: string[] = [];
  for (let i = 0; i < data.cve.length; i++) {
    const slice = data.cve[i];
    if (slice?.status === 'not-enabled') {
      const repo = data.repos[i];
      if (repo) disabledRepos.push(`${repo.owner}/${repo.name}`);
    }
  }
  const allAlerts = okSlices.flatMap((s) => s.alerts);
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
    .sort((a, b) => severityScore(b) - severityScore(a))
    .slice(0, 5);

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

function buildRecommendations(input: {
  prBacklog: PrBacklog;
  stalledSignals: StalledSignals;
  cve: CveExposure;
  dependabotCoverage: DependabotCoverage;
  orgOverview: OrgOverview;
}): Recommendation[] {
  const recs: Recommendation[] = [];
  const { prBacklog, stalledSignals, cve, dependabotCoverage, orgOverview } = input;

  if (stalledSignals.reposAtPrCap.length >= 5) {
    recs.push({
      priority: 'high',
      message: `${stalledSignals.reposAtPrCap.length} repos are sitting at Dependabot's default 5-PR cap. New PRs (including security ones) may not be opening invisibly — CVE exposure could be accumulating.`,
    });
  }

  if (cve.status === 'ok' && cve.oldestCriticalDays !== null && cve.oldestCriticalDays >= 90) {
    recs.push({
      priority: 'high',
      message: `You have at least one Critical CVE open for ${cve.oldestCriticalDays}+ days. This is an audit-risk finding even before it lands in a customer environment.`,
    });
  }

  const liveRepoCount = orgOverview.repoCount;
  if (liveRepoCount > 0 && dependabotCoverage.reposWithConfigPercentage < 50) {
    recs.push({
      priority: 'medium',
      message: `Only ${dependabotCoverage.reposWithConfigPercentage}% of your active repos have a Dependabot config file. Coverage gaps mean new CVEs may never reach you as PRs.`,
    });
  }

  const oldestOpen = prBacklog.oldestOpenDays;
  if (oldestOpen !== null && oldestOpen >= 180) {
    recs.push({
      priority: 'medium',
      message: `Your oldest open Dependabot PR is ${oldestOpen} days old. Stale PRs are the leading indicator that Dependabot will eventually stop opening new ones in that repo.`,
    });
  }

  return recs;
}

function severityScore(rec: { critical: number; high: number; medium: number; low: number }): number {
  return rec.critical * 1000 + rec.high * 100 + rec.medium * 10 + rec.low;
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
