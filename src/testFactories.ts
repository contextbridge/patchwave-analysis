import { Factory } from 'fishery';
import { instantFromString } from './time.ts';
import type {
  BranchProtectionSlice,
  CheckSummary,
  CollectedData,
  CollectionContext,
  CollectorWarning,
  ContributorSlice,
  CveAlert,
  CveSlice,
  DependabotConfigSlice,
  DependabotPr,
  DependabotUpdateEntry,
  RepoLanguages,
  RepoMeta,
  RepoRef,
} from './types.ts';

export const repoRef = Factory.define<RepoRef>(() => ({
  owner: 'acme',
  name: 'widgets',
}));

export const repoMeta = Factory.define<RepoMeta>(() => ({
  owner: 'acme',
  name: 'widgets',
  visibility: 'private',
  archived: false,
  fork: false,
  defaultBranch: 'main',
  primaryLanguage: 'TypeScript',
  pushedAt: '2026-04-01T00:00:00Z',
  dependabotSecurityUpdates: true,
}));

export const checkSummary = Factory.define<CheckSummary>(() => ({
  total: 0,
  success: 0,
  failure: 0,
  pending: 0,
  failedCheckNames: [],
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
  checks: checkSummary.build(),
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

export const branchProtectionSlice = Factory.define<BranchProtectionSlice>(() => ({
  owner: 'acme',
  name: 'widgets',
  hasProtection: true,
  sources: ['classic'],
  requiredApprovingReviewCount: 1,
  requiresStatusChecks: true,
}));

export const contributorSlice = Factory.define<ContributorSlice>(() => ({
  owner: 'acme',
  name: 'widgets',
  activeHumanLogins: [],
}));

export const dependabotUpdateEntry = Factory.define<DependabotUpdateEntry>(() => ({
  ecosystem: 'npm',
  interval: 'weekly',
  openPullRequestsLimit: 5,
  groupCount: 0,
  ignoreCount: 0,
}));

export const dependabotConfigSlice = Factory.define<DependabotConfigSlice>(() => ({
  owner: 'acme',
  name: 'widgets',
  hasConfig: true,
  ecosystems: ['npm'],
  updates: [dependabotUpdateEntry.build()],
}));

export const repoLanguages = Factory.define<RepoLanguages>(() => ({
  owner: 'acme',
  name: 'widgets',
  bytes: { TypeScript: 100_000, JavaScript: 20_000 },
}));

export const collectorWarning = Factory.define<CollectorWarning>(() => ({
  collector: 'branchProtection',
  repo: { owner: 'acme', name: 'widgets' },
  message: 'GitHub returned 500',
}));

export const collectionContext = Factory.define<CollectionContext>(() => ({
  org: 'acme',
  windowDays: 90,
  windowStart: instantFromString('2026-02-21T00:00:00Z'),
  now: instantFromString('2026-05-22T00:00:00Z'),
}));

export const collectedData = Factory.define<CollectedData>(() => ({
  ctx: collectionContext.build(),
  repos: [repoMeta.build()],
  languages: [repoLanguages.build()],
  dependabotConfig: [dependabotConfigSlice.build()],
  dependabotPrs: [],
  cve: [cveSliceOk.build()],
  branchProtection: [branchProtectionSlice.build()],
  contributors: [contributorSlice.build()],
  errors: [],
}));
