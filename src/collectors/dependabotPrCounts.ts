import type { ResultAsync } from 'neverthrow';
import type { GithubError } from '../github/errors.ts';
import type { GithubClient } from '../github/GithubClient.ts';
import { DependabotPrCountsDocument } from '../github/graphql/generated.ts';
import type { DependabotPrCounts } from '../types.ts';
import type { TargetKind } from './repos.ts';

/**
 * Fetches exact org-wide Dependabot PR counts (open / merged-in-window /
 * closed-unmerged-in-window) via a single GraphQL `search` request.
 *
 * Unlike `dependabotPrs.ts` (which walks repos directly for per-PR detail),
 * this deliberately uses `search`. The repo's older "never use search" rule was
 * based on a misconfigured token: verified against a real fine-grained token,
 * `search` returns private repos and exact counts (it supports `author:`,
 * `archived:`, and `merged:`/`closed:` date qualifiers). The token's
 * search/PR-read access is confirmed by a pre-flight check before this runs.
 */
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

interface CountQueries {
  readonly open: string;
  readonly merged: string;
  readonly closedUnmerged: string;
}

function buildCountQueries(target: string, kind: TargetKind, windowStartIso: string): CountQueries {
  const scope = kind === 'org' ? `org:${target}` : `user:${target}`;
  const since = windowStartIso.slice(0, 10);
  const base = `is:pr author:app/dependabot archived:false ${scope}`;
  return {
    open: `${base} is:open`,
    merged: `${base} is:merged merged:>=${since}`,
    closedUnmerged: `${base} is:unmerged is:closed closed:>=${since}`,
  };
}
