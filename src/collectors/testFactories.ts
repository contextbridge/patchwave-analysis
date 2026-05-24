import { Factory } from 'fishery';
import type { RawPullRequest } from './dependabotPrs.ts';

export const rawPullRequest = Factory.define<RawPullRequest>(() => ({
  number: 1,
  title: 'Bump lodash from 4.17.20 to 4.17.21',
  state: 'OPEN',
  createdAt: '2026-04-01T00:00:00Z',
  closedAt: null,
  mergedAt: null,
  url: 'https://github.com/acme/widgets/pull/1',
  baseRefName: 'main',
  headRefName: 'dependabot/npm_and_yarn/lodash-4.17.21',
  mergedBy: null,
  autoMergeRequest: null,
  repository: { owner: { login: 'acme' }, name: 'widgets' },
  reviews: { nodes: [] },
  comments: { nodes: [] },
  commits: { nodes: [{ commit: { statusCheckRollup: null } }] },
}));
