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

// A repo worth analyzing: archived repos generate no new Dependabot toil, and
// forks track upstream dependencies we don't own. Both the crawl and the report
// scope to active repos through this single predicate.
export function isActiveRepo(repo: RepoMeta): boolean {
  return !repo.archived && !repo.fork;
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

export interface CollectionContext {
  org: string;
  windowDays: number;
  windowStart: Instant;
  now: Instant;
}

export interface CollectedData {
  ctx: CollectionContext;
  repos: RepoMeta[];
  dependabotPrs: DependabotPr[];
  cve: CveSlice[];
  errors: CollectorWarning[];
}

export interface CollectorWarning {
  collector: string;
  repo?: RepoRef;
  message: string;
}
