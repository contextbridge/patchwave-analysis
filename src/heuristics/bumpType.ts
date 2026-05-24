import { Result } from 'neverthrow';
import semver from 'semver';

export type BumpType = 'patch' | 'minor' | 'major' | 'grouped' | 'other';

const BUMP_RE = /[Bb]ump\s+\S+\s+from\s+([^\s]+)\s+to\s+([^\s]+)/;
const GROUPED_RE = /\bbump the \S+ group\b/i;

const safeDiff = Result.fromThrowable(
  (from: string | semver.SemVer, to: string | semver.SemVer) => semver.diff(from, to),
  () => 'diff-failed' as const,
);

export function classifyBumpType(prTitle: string): BumpType {
  if (GROUPED_RE.test(prTitle)) return 'grouped';
  const match = BUMP_RE.exec(prTitle);
  if (!match) return 'other';
  const from = semver.coerce(match[1] ?? '');
  const to = semver.coerce(match[2] ?? '');
  if (!from || !to) return 'other';

  const diff = safeDiff(from, to).unwrapOr(null);
  if (diff === null) return 'other';
  if (diff === 'major' || diff === 'premajor') return 'major';
  if (diff === 'minor' || diff === 'preminor') return 'minor';
  if (diff === 'patch' || diff === 'prepatch' || diff === 'prerelease') return 'patch';
  return 'other';
}

export function isDevDependencyBump(prTitle: string): boolean {
  return /\(deps-dev\)/.test(prTitle);
}
