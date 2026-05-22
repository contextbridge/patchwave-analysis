import { Result } from 'neverthrow';
import semver from 'semver';

export type BumpType = 'patch' | 'minor' | 'major' | 'unknown';

const BUMP_RE = /[Bb]ump\s+\S+\s+from\s+([^\s]+)\s+to\s+([^\s]+)/;

const safeDiff = Result.fromThrowable(
  (from: string | semver.SemVer, to: string | semver.SemVer) => semver.diff(from, to),
  () => 'diff-failed' as const,
);

export function classifyBumpType(prTitle: string): BumpType {
  const match = BUMP_RE.exec(prTitle);
  if (!match) return 'unknown';
  const from = semver.coerce(match[1] ?? '');
  const to = semver.coerce(match[2] ?? '');
  if (!from || !to) return 'unknown';

  const diff = safeDiff(from, to).unwrapOr(null);
  if (diff === null) return 'unknown';
  if (diff === 'major' || diff === 'premajor') return 'major';
  if (diff === 'minor' || diff === 'preminor') return 'minor';
  if (diff === 'patch' || diff === 'prepatch' || diff === 'prerelease') return 'patch';
  return 'unknown';
}

export function isDevDependencyBump(prTitle: string): boolean {
  return /\(deps-dev\)/.test(prTitle);
}
