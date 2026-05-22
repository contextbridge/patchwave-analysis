export type Visibility = 'public' | 'private' | 'internal';

export interface RepoRef {
  owner: string;
  name: string;
}

export interface RepoMeta extends RepoRef {
  visibility: Visibility;
  archived: boolean;
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

export interface DependabotConfigSlice extends RepoRef {
  hasConfig: boolean;
  ecosystems: DependabotEcosystem[];
  packageManager: 'npm' | 'yarn' | 'pnpm' | 'bun' | 'unknown' | null;
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

export type CveSlice =
  | { status: 'ok'; alerts: CveAlert[] }
  | { status: 'scope-missing'; requiredScope: string }
  | { status: 'not-enabled' };

export interface RevertEvent extends RepoRef {
  sha: string;
  message: string;
  committedAt: string;
  revertsDependabotPr: boolean;
  revertedPrNumber: number | null;
}

export interface BranchProtectionSlice extends RepoRef {
  hasProtection: boolean;
  requiredApprovingReviewCount: number | null;
  requiresStatusChecks: boolean;
}

export interface ContributorSlice extends RepoRef {
  activeHumanLogins: string[];
}

export interface CollectionContext {
  org: string;
  windowDays: number;
  windowStartIso: string;
  now: Date;
}

export interface CollectedData {
  ctx: CollectionContext;
  repos: RepoMeta[];
  languages: RepoLanguages[];
  dependabotConfig: DependabotConfigSlice[];
  dependabotPrs: DependabotPr[];
  cve: CveSlice[];
  reverts: RevertEvent[];
  branchProtection: BranchProtectionSlice[];
  contributors: ContributorSlice[];
  errors: CollectorWarning[];
}

export interface CollectorWarning {
  collector: string;
  repo?: string;
  message: string;
}
