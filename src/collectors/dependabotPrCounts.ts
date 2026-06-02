import type { ResultAsync } from 'neverthrow';
import type { GithubError } from '../github/errors.ts';
import type { GithubClient } from '../github/GithubClient.ts';
import { DependabotPrCountsDocument } from '../github/graphql/generated.ts';
import type { DependabotPrCounts } from '../types.ts';
import type { TargetKind } from './repos.ts';

interface CountQueries {
  readonly open: string;
  readonly merged: string;
  readonly closedUnmerged: string;
}

export function buildCountQueries(target: string, kind: TargetKind, windowStartIso: string): CountQueries {
  const scope = kind === 'org' ? `org:${target}` : `user:${target}`;
  const since = windowStartIso.slice(0, 10);
  const base = `is:pr author:app/dependabot archived:false ${scope}`;
  return {
    open: `${base} is:open`,
    merged: `${base} is:merged merged:>=${since}`,
    closedUnmerged: `${base} is:unmerged is:closed closed:>=${since}`,
  };
}

export function listDependabotPrCounts(
  client: GithubClient,
  target: string,
  kind: TargetKind,
  windowStartIso: string,
): ResultAsync<DependabotPrCounts, GithubError> {
  const queries = buildCountQueries(target, kind, windowStartIso);
  return client
    .graphql(DependabotPrCountsDocument, {
      open: queries.open,
      merged: queries.merged,
      closedUnmerged: queries.closedUnmerged,
    })
    .map((res) => ({
      open: res.open.issueCount,
      mergedInWindow: res.merged.issueCount,
      closedUnmergedInWindow: res.closedUnmerged.issueCount,
    }));
}
