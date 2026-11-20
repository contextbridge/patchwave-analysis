import type { ConventionalCommit } from 'release-please';
import { ManifestPlugin } from 'release-please/build/src/plugin.js';

export const IGNORE_DEPENDABOT_PLUGIN = 'ignore-dependabot';

/**
 * Dependabot commit bodies quote upstream changelogs, whose "BREAKING CHANGE:"
 * lines release-please would otherwise read as ours. Dropping the commits keeps
 * them out of both the version bump and CHANGELOG.md; a dependency change
 * worth announcing gets its own human-written `deps:` commit.
 *
 * release-please strips commit authors before plugins run, so Dependabot is
 * recognized by its PR branch instead.
 */
export class IgnoreDependabot extends ManifestPlugin {
  override processCommits(commits: ConventionalCommit[]): ConventionalCommit[] {
    return commits.filter((commit) => !commit.pullRequest?.headBranchName.startsWith('dependabot/'));
  }
}
