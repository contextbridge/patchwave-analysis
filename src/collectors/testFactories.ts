import { Factory } from 'fishery';
import type { PrNode } from './dependabotPrs.ts';

export const rawPullRequest = Factory.define<PrNode>(({ sequence }) => ({
  number: sequence,
  title: 'Bump lodash from 4.17.20 to 4.17.21',
  state: 'OPEN',
  createdAt: '2026-04-01T00:00:00Z',
  updatedAt: '2026-04-01T00:00:00Z',
  closedAt: null,
  mergedAt: null,
  url: 'https://github.com/acme/widgets/pull/1',
  baseRefName: 'main',
  headRefName: 'dependabot/npm_and_yarn/lodash-4.17.21',
  author: { __typename: 'Bot', login: 'dependabot' },
  mergedBy: null,
  autoMergeRequest: null,
  reviews: { nodes: [] },
  comments: { nodes: [] },
}));
