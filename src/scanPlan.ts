import type { TargetKind } from './collectors/repos.ts';
import type { RateLimitStatus } from './github/rateLimit.ts';

export type CollectorKey =
  | 'languages'
  | 'dependabotConfig'
  | 'cve'
  | 'branchProtection'
  | 'contributors'
  | 'dependabotPrs';

export type CollectorMode = 'exact' | 'metadata' | 'org-endpoint';

export type SkipReason = 'budget' | 'unsupported-target' | 'rate-limit-unavailable';

export interface SkippedCollector {
  readonly reason: SkipReason;
  readonly message: string;
}

export interface ScanPlan {
  readonly restBudget: number;
  readonly graphqlBudget: number;
  readonly restReserve: number;
  readonly include: ReadonlySet<CollectorKey>;
  readonly modes: Partial<Record<CollectorKey, CollectorMode>>;
  readonly skipped: Partial<Record<CollectorKey, SkippedCollector>>;
  readonly estimatedRestCost: Record<CollectorKey, number>;
  readonly estimatedGraphqlCost: Record<CollectorKey, number>;
}

export interface ApiBudget {
  readonly restRemaining: number;
  readonly graphqlRemaining: number;
  readonly source: 'github' | 'default';
}

export interface BuildScanPlanInput {
  readonly targetKind: TargetKind;
  readonly repoCount: number;
  readonly apiBudget: ApiBudget;
}

export const COLLECTOR_KEYS: readonly CollectorKey[] = [
  'languages',
  'dependabotConfig',
  'cve',
  'branchProtection',
  'contributors',
  'dependabotPrs',
];

const REST_RESERVE = 500;
const DEFAULT_REST_REMAINING = 5_000;
const DEFAULT_GRAPHQL_REMAINING = 5_000;
const ORG_CVE_ESTIMATED_REST_COST = 25;
const CONTRIBUTORS_MAX_REPOS_FOR_FULL_SCAN = 500;

export const DEFAULT_API_BUDGET: ApiBudget = {
  restRemaining: DEFAULT_REST_REMAINING,
  graphqlRemaining: DEFAULT_GRAPHQL_REMAINING,
  source: 'default',
};

export function apiBudgetFromRateLimit(rateLimit: RateLimitStatus): ApiBudget {
  return {
    restRemaining: rateLimit.rest.remaining,
    graphqlRemaining: rateLimit.graphql.remaining,
    source: 'github',
  };
}

export function buildScanPlan(input: BuildScanPlanInput): ScanPlan {
  const { targetKind, repoCount, apiBudget } = input;
  const restBudget = Math.max(0, apiBudget.restRemaining - REST_RESERVE);
  const graphqlBudget = apiBudget.graphqlRemaining;
  let remainingRest = restBudget;

  const include = new Set<CollectorKey>();
  const modes: Partial<Record<CollectorKey, CollectorMode>> = {};
  const skipped: Partial<Record<CollectorKey, SkippedCollector>> = {};
  const estimatedRestCost = buildRestEstimates(targetKind, repoCount);
  const estimatedGraphqlCost = buildGraphqlEstimates(graphqlBudget);

  add(include, modes, 'dependabotPrs', 'exact');

  if (targetKind === 'org' && remainingRest > 0) {
    add(include, modes, 'cve', 'org-endpoint');
    remainingRest -= Math.min(remainingRest, estimatedRestCost.cve);
  } else if (targetKind === 'user' && spend(remainingRest, estimatedRestCost.cve)) {
    add(include, modes, 'cve', 'exact');
    remainingRest -= estimatedRestCost.cve;
  } else {
    skip(
      skipped,
      'cve',
      'budget',
      'CVE exposure was not measured because the remaining REST budget could not cover it.',
    );
  }

  if (repoCount <= 500 && spend(remainingRest, estimatedRestCost.languages)) {
    add(include, modes, 'languages', 'exact');
    remainingRest -= estimatedRestCost.languages;
  } else {
    add(include, modes, 'languages', 'metadata');
  }

  if (spend(remainingRest, estimatedRestCost.dependabotConfig)) {
    add(include, modes, 'dependabotConfig', 'exact');
    remainingRest -= estimatedRestCost.dependabotConfig;
  } else {
    skip(
      skipped,
      'dependabotConfig',
      'budget',
      'Dependabot config parsing was skipped to stay within the GitHub API budget.',
    );
  }

  if (spend(remainingRest, estimatedRestCost.branchProtection)) {
    add(include, modes, 'branchProtection', 'exact');
    remainingRest -= estimatedRestCost.branchProtection;
  } else {
    skip(skipped, 'branchProtection', 'budget', 'Branch protection was skipped to stay within the GitHub API budget.');
  }

  if (repoCount <= CONTRIBUTORS_MAX_REPOS_FOR_FULL_SCAN && spend(remainingRest, estimatedRestCost.contributors)) {
    add(include, modes, 'contributors', 'exact');
  } else {
    skip(
      skipped,
      'contributors',
      'budget',
      'Active committers were skipped because this collector can paginate heavily on large orgs.',
    );
  }

  return {
    restBudget,
    graphqlBudget,
    restReserve: REST_RESERVE,
    include,
    modes,
    skipped,
    estimatedRestCost,
    estimatedGraphqlCost,
  };
}

export function countSkipped(plan: ScanPlan): number {
  return Object.keys(plan.skipped).length;
}

export function isBudgetConstrained(plan: ScanPlan): boolean {
  return countSkipped(plan) > 0 || Object.values(plan.modes).some((mode) => mode === 'metadata');
}

function buildRestEstimates(targetKind: TargetKind, repoCount: number): Record<CollectorKey, number> {
  return {
    dependabotPrs: 0,
    cve: targetKind === 'org' ? ORG_CVE_ESTIMATED_REST_COST : repoCount,
    languages: repoCount,
    dependabotConfig: repoCount * 2,
    branchProtection: repoCount * 2,
    contributors: repoCount * 2,
  };
}

function buildGraphqlEstimates(graphqlBudget: number): Record<CollectorKey, number> {
  return {
    dependabotPrs: Math.min(100, graphqlBudget),
    cve: 0,
    languages: 0,
    dependabotConfig: 0,
    branchProtection: 0,
    contributors: 0,
  };
}

function add(
  include: Set<CollectorKey>,
  modes: Partial<Record<CollectorKey, CollectorMode>>,
  collector: CollectorKey,
  mode: CollectorMode,
): void {
  include.add(collector);
  modes[collector] = mode;
}

function skip(
  skipped: Partial<Record<CollectorKey, SkippedCollector>>,
  collector: CollectorKey,
  reason: SkipReason,
  message: string,
): void {
  skipped[collector] = { reason, message };
}

function spend(remaining: number, cost: number): boolean {
  return cost <= remaining;
}
