import type { Instant } from './time.ts';

export type Visibility = 'public' | 'private' | 'internal';

export interface RepoRef {
  owner: string;
  name: string;
}

export interface RepoMeta extends RepoRef {
  nodeId: string;
  visibility: Visibility;
  archived: boolean;
  fork: boolean;
  defaultBranch: string;
  primaryLanguage: string | null;
  pushedAt: string | null;
  dependabotSecurityUpdates: boolean | null;
  dependabotAlertsEnabled: boolean | null;
}

export type DependabotEcosystem = string;

export type DependabotInterval = 'daily' | 'weekly' | 'monthly';

export interface DependabotUpdateEntry {
  ecosystem: DependabotEcosystem;
  interval: DependabotInterval | null;
  openPullRequestsLimit: number;
  groupCount: number;
  ignoreCount: number;
}

export interface DependabotConfigSlice extends RepoRef {
  hasConfig: boolean;
  ecosystems: DependabotEcosystem[];
  updates: DependabotUpdateEntry[];
}

export type PrState = 'open' | 'closed';

export interface DependabotPr extends RepoRef {
  number: number;
  title: string;
  state: PrState;
  merged: boolean;
  createdAt: string;
  closedAt: string | null;
  mergedAt: string | null;
  mergedBy: string | null;
  headRef: string;
  baseRef: string;
  htmlUrl: string;
  reviewers: string[];
  commenters: string[];
  autoMergeEnabled: boolean;
}

export type CveSeverity = 'critical' | 'high' | 'medium' | 'low';

export interface CveAlert extends RepoRef {
  number: number;
  severity: CveSeverity;
  createdAt: string;
  packageName: string;
  ecosystem: string;
  summary: string;
}

export type CveSlice = RepoRef &
  (
    | { status: 'ok'; alerts: CveAlert[] }
    | { status: 'scope-missing'; requiredScope: string }
    | { status: 'not-enabled' }
  );

export type BranchProtectionSource = 'classic' | 'ruleset';

export interface BranchProtectionSlice extends RepoRef {
  hasProtection: boolean;
  sources: BranchProtectionSource[];
  requiredApprovingReviewCount: number | null;
  requiresStatusChecks: boolean;
}

export interface CollectionContext {
  org: string;
  windowDays: number;
  windowStart: Instant;
  now: Instant;
}

/**
 * Whether the token could actually read pull requests, as determined by the
 * pre-flight probe (`collectors/prReadProbe.ts`). `unreadable` means a repo's
 * pulls endpoint returned 403/404, so the Dependabot backlog would come back
 * empty for lack of access rather than because there's nothing to find.
 * `unknown` means the probe hit an unrelated error and we drew no conclusion.
 */
export type PrAccess = 'ok' | 'unreadable' | 'unknown';

export interface CollectedData {
  ctx: CollectionContext;
  repos: RepoMeta[];
  dependabotConfig: DependabotConfigSlice[];
  dependabotPrs: DependabotPr[];
  cve: CveSlice[];
  branchProtection: BranchProtectionSlice[];
  errors: CollectorWarning[];
}

export interface CollectorWarning {
  collector: string;
  repo?: RepoRef;
  message: string;
}
