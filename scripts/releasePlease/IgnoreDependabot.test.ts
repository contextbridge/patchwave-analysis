import { describe, expect, it } from 'bun:test';
import { Factory } from 'fishery';
import type { Commit, GitHub, PullRequest } from 'release-please';
import { parseConventionalCommits } from 'release-please/build/src/commit.js';
import { IgnoreDependabot } from './IgnoreDependabot.ts';

describe('IgnoreDependabot', () => {
  it('drops Dependabot commits whose quoted changelog reads as a breaking change', () => {
    const dependabot = commit.build({
      message: [
        'build(deps-dev): bump @graphql-codegen/typed-document-node from 7.2.0 to 8.0.0 (#97)',
        '',
        '<p>',
        'BREAKING CHANGE: GraphQL 14 and 15 are no',
        'longer supported.</p>',
      ].join('\n'),
      pullRequest: pullRequest.build({ headBranchName: 'dependabot/bun/graphql-codegen/typed-document-node-8.0.0' }),
    });
    const feature = commit.build();
    const parsed = parseConventionalCommits([dependabot, feature]);

    expect(parsed).toMatchObject([{ breaking: true }, { breaking: false }]);
    expect(plugin().processCommits(parsed)).toMatchObject([{ sha: feature.sha }]);
  });

  it('keeps human-written dependency commits', () => {
    const parsed = parseConventionalCommits([commit.build({ message: 'deps: upgrade octokit to fix retries' })]);

    expect(plugin().processCommits(parsed)).toEqual(parsed);
  });

  it('keeps commits with no associated pull request', () => {
    const parsed = parseConventionalCommits([commit.build({ pullRequest: undefined })]);

    expect(plugin().processCommits(parsed)).toEqual(parsed);
  });
});

const pullRequest = Factory.define<PullRequest>(({ sequence }) => ({
  number: sequence,
  title: 'feat: add a thing',
  body: '',
  headBranchName: `feature-${sequence}`,
  baseBranchName: 'main',
  labels: [],
  files: [],
}));

const commit = Factory.define<Commit>(({ sequence }) => ({
  sha: `sha${sequence}`,
  message: 'feat: add a thing',
  pullRequest: pullRequest.build(),
}));

function plugin(): IgnoreDependabot {
  return new IgnoreDependabot({} as GitHub, 'main', {});
}
