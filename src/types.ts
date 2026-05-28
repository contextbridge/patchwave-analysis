import type { Instant } from './time.ts';

export type Visibility = 'public' | 'private' | 'internal';

export interface RepoRef {
  owner: string;
  name: string;
}

export interface RepoMeta extends RepoRef {
  visibility: Visibility;
  archived: boolean;
  fork: boolean;
  defaultBranch: string;
  primaryLanguage: string | null;
  pushedAt: string | null;
  dependabotSecurityUpdates: boolean | null;
}

export interface LanguageBytes {
  [language: string]: number;
}

export interface RepoLanguages extends RepoRef {
  bytes: LanguageBytes;
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

export interface CheckSummary {
  total: number;
  success: number;
  failure: number;
  pending: number;
  failedCheckNames: string[];
}

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
  checks: CheckSummary;
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

export interface CollectedData {
  ctx: CollectionContext;
  repos: RepoMeta[];
  languages: RepoLanguages[];
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
