import { Factory } from 'fishery';
import { instantFromString } from './time.ts';
import type { CollectedData, CollectionContext, CveAlert, CveSlice, DependabotPr, RepoMeta } from './types.ts';

// Raw GitHub REST API response shape (snake_case) for `GET /orgs/{org}/repos`
// and `GET /users/{username}/repos`. Used in CLI/integration tests that stub
// the GitHub client's paginate responses before they are parsed by repos.ts.
export interface GithubRepoResponse {
  name: string;
  node_id: string;
  owner: { login: string };
  private: boolean;
  visibility: string;
  archived?: boolean;
  fork?: boolean;
  default_branch: string;
  language: string | null;
  pushed_at: string | null;
}

export const githubRepoResponse = Factory.define<GithubRepoResponse>(() => ({
  name: 'widgets',
  node_id: 'R_kgDOwidgets',
  owner: { login: 'acme' },
  private: true,
  visibility: 'private',
  archived: false,
  fork: false,
  default_branch: 'main',
  language: 'TypeScript',
  pushed_at: '2026-04-01T00:00:00Z',
}));

export const repoMeta = Factory.define<RepoMeta>(() => ({
  owner: 'acme',
  name: 'widgets',
  nodeId: 'R_kgDOwidgets',
  visibility: 'private',
  archived: false,
  fork: false,
  defaultBranch: 'main',
  primaryLanguage: 'TypeScript',
  pushedAt: '2026-04-01T00:00:00Z',
  dependabotSecurityUpdates: true,
  dependabotAlertsEnabled: true,
}));

export const dependabotPr = Factory.define<DependabotPr>(({ sequence }) => ({
  owner: 'acme',
  name: 'widgets',
  number: sequence,
  title: `Bump lodash from 4.17.20 to 4.17.21`,
  state: 'open',
  merged: false,
  createdAt: '2026-04-01T00:00:00Z',
  closedAt: null,
  mergedAt: null,
  mergedBy: null,
  headRef: `dependabot/npm_and_yarn/lodash-4.17.21`,
  baseRef: 'main',
  htmlUrl: `https://github.com/acme/widgets/pull/${sequence}`,
  reviewers: [],
  commenters: [],
  autoMergeEnabled: false,
}));

export const cveAlert = Factory.define<CveAlert>(({ sequence }) => ({
  owner: 'acme',
  name: 'widgets',
  number: sequence,
  severity: 'high',
  createdAt: '2026-03-01T00:00:00Z',
  packageName: 'lodash',
  ecosystem: 'npm',
  summary: 'Prototype pollution',
}));

export const cveSliceOk = Factory.define<Extract<CveSlice, { status: 'ok' }>>(() => ({
  owner: 'acme',
  name: 'widgets',
  status: 'ok',
  alerts: [],
}));

export const collectionContext = Factory.define<CollectionContext>(() => ({
  org: 'acme',
  windowDays: 90,
  windowStart: instantFromString('2026-02-21T00:00:00Z'),
  now: instantFromString('2026-05-22T00:00:00Z'),
  repositorySelection: { mode: 'all', selectedRepoKeys: ['acme/widgets'], availableActiveRepoCount: 1 },
}));

export const collectedData = Factory.define<CollectedData>(() => ({
  ctx: collectionContext.build(),
  repos: [repoMeta.build()],
  dependabotPrs: [],
  cve: [cveSliceOk.build()],
  errors: [],
}));
