import { classifyBumpType, isDevDependencyBump } from '../heuristics/bumpType.ts';
import { type Instant, Temporal, instantFromString } from '../time.ts';
import { type CollectedData, type CveAlert, type CveSeverity, type DependabotPr, isActiveRepo } from '../types.ts';
import { ASSUMED_HOURLY_RATE_USD, ASSUMED_MIN_PER_PR, deriveCostEstimate, derivePersonCosts } from './costFormulas.ts';

export interface ReportBundle {
  meta: ReportMeta;
  orgOverview: OrgOverview;
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
}

export interface OrgOverview {
  repoCount: number;
  publicCount: number;
  privateCount: number;
  internalCount: number;
  archivedExcluded: number;
  topLanguages: Array<{ language: string; repoCount: number; percentage: number }>;
  nodeTsRepoCount: number;
  nodeTsRepoPercentage: number;
  reposWithSecurityUpdates: number;
  reposWithSecurityUpdatesPercentage: number;
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
  timeToMergeP50Days: number | null;
  timeToMergeP90Days: number | null;
}

export interface StalledSignals {
  reposAtPrCap: Array<{ repo: string; openPrs: number }>;
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
  };

  const orgOverview = buildOrgOverview(data);
  const prBacklog = buildPrBacklog(data, now, windowStart);
  const stalledSignals = buildStalledSignals(data);
  const people = buildPeople(data, data.ctx.windowDays);
  const costEstimate = buildCostEstimate(people, prBacklog.openCount, data.ctx.windowDays);
  const cve = buildCveExposure(data, now);

  return {
    meta,
    orgOverview,
    prBacklog,
    stalledSignals,
    people,
    costEstimate,
    cve,
  };
}

function buildOrgOverview(data: CollectedData): OrgOverview {
  const repos = data.repos.filter(isActiveRepo);
  const archivedExcluded = data.repos.filter((r) => r.archived).length;
  const publicCount = repos.filter((r) => r.visibility === 'public').length;
  const privateCount = repos.filter((r) => r.visibility === 'private').length;
  const internalCount = repos.filter((r) => r.visibility === 'internal').length;

  const langCounts = new Map<string, number>();
  for (const r of repos) {
    if (r.primaryLanguage) langCounts.set(r.primaryLanguage, (langCounts.get(r.primaryLanguage) ?? 0) + 1);
  }
  const totalLangRepos = [...langCounts.values()].reduce((a, b) => a + b, 0);
  const topLanguages = [...langCounts.entries()]
    .map(([language, repoCount]) => ({
      language,
      repoCount,
      percentage: totalLangRepos > 0 ? round1((repoCount / totalLangRepos) * 100) : 0,
    }))
    .sort((a, b) => b.repoCount - a.repoCount)
    .slice(0, 10);

  const nodeTsRepoCount = repos.filter(
    (r) => r.primaryLanguage === 'TypeScript' || r.primaryLanguage === 'JavaScript',
  ).length;

  // Security-update coverage comes from the REST repo list (`RepoMeta.dependabotSecurityUpdates`).
  const reposWithSecurityUpdates = repos.filter((r) => r.dependabotSecurityUpdates === true).length;

  return {
    repoCount: repos.length,
    publicCount,
    privateCount,
    internalCount,
    archivedExcluded,
    topLanguages,
    nodeTsRepoCount,
    nodeTsRepoPercentage: pct(nodeTsRepoCount, repos.length),
    reposWithSecurityUpdates,
    reposWithSecurityUpdatesPercentage: pct(reposWithSecurityUpdates, repos.length),
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
    timeToMergeP50Days,
    timeToMergeP90Days,
  };
}

// Repos with at least Dependabot's default open-PR cap (5) outstanding — a signal
// that the queue is backing up.
function buildStalledSignals(data: CollectedData): StalledSignals {
  const openByRepo = new Map<string, DependabotPr[]>();
  for (const pr of data.dependabotPrs) {
    if (pr.state !== 'open') continue;
    const key = `${pr.owner}/${pr.name}`;
    const list = openByRepo.get(key) ?? [];
    list.push(pr);
    openByRepo.set(key, list);
  }
  const reposAtPrCap = [...openByRepo.entries()]
    .filter(([, list]) => list.length >= DEFAULT_PR_CAP)
    .map(([repo, list]) => ({ repo, openPrs: list.length }))
    .sort((a, b) => b.openPrs - a.openPrs);

  return { reposAtPrCap };
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

function isBotLogin(login: string): boolean {
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
