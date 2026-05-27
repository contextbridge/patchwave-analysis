import { ResultAsync, okAsync } from 'neverthrow';
import type { GithubError } from '../github/errors.ts';
import type { GithubClient } from '../github/GithubClient.ts';
import { DependabotPrsDocument, type DependabotPrsQuery } from '../github/graphql/generated.ts';
import type { CheckSummary, DependabotPr, PrState } from '../types.ts';

// `search(type: ISSUE)` returns a union; nodes that aren't pull requests come
// back as empty objects, so a real PR node is the arm carrying `number`.
type SearchNode = NonNullable<DependabotPrsQuery['search']['nodes']>[number];
export type PrNode = Extract<SearchNode, { number: number }>;

// GitHub's GraphQL Actor interface. `__typename` is the source of truth for
// whether an actor is a bot: GitHub App accounts (e.g. greptile-apps) surface
// here as `Bot` and — unlike the REST API — carry no `[bot]` login suffix.
type Actor = NonNullable<PrNode['mergedBy']>;
type AuthoredNode = { author: Actor | null } | null;

export function listDependabotPrs(
  client: GithubClient,
  org: string,
  windowStartIso: string,
): ResultAsync<DependabotPr[], GithubError> {
  const searchQuery = [`is:pr`, `author:app/dependabot`, `org:${org}`, `updated:>=${windowStartIso.slice(0, 10)}`].join(
    ' ',
  );
  return pageThrough(client, searchQuery, null, []);
}

function pageThrough(
  client: GithubClient,
  searchQuery: string,
  cursor: string | null,
  acc: DependabotPr[],
): ResultAsync<DependabotPr[], GithubError> {
  return client.graphql(DependabotPrsDocument, { searchQuery, cursor }).andThen((res) => {
    for (const node of res.search.nodes ?? []) {
      if (isPrNode(node)) acc.push(toDependabotPr(node));
    }
    if (res.search.pageInfo.hasNextPage && res.search.pageInfo.endCursor) {
      return pageThrough(client, searchQuery, res.search.pageInfo.endCursor, acc);
    }
    return okAsync<DependabotPr[], GithubError>(acc);
  });
}

function isPrNode(node: SearchNode): node is PrNode {
  return node !== null && 'number' in node;
}

function toDependabotPr(raw: PrNode): DependabotPr {
  const state: PrState = raw.state === 'OPEN' ? 'open' : 'closed';
  const merged = raw.state === 'MERGED';
  return {
    owner: raw.repository.owner.login,
    name: raw.repository.name,
    number: raw.number,
    title: raw.title,
    state,
    merged,
    createdAt: raw.createdAt,
    closedAt: raw.closedAt,
    mergedAt: raw.mergedAt,
    mergedBy: raw.mergedBy && !isBotActor(raw.mergedBy) ? raw.mergedBy.login : null,
    headRef: raw.headRefName,
    baseRef: raw.baseRefName,
    htmlUrl: raw.url,
    reviewers: uniqueLogins(raw.reviews?.nodes),
    commenters: uniqueLogins(raw.comments?.nodes),
    autoMergeEnabled: raw.autoMergeRequest !== null,
    checks: summarizeChecks(raw),
  };
}

function summarizeChecks(raw: PrNode): CheckSummary {
  const summary: CheckSummary = {
    total: 0,
    success: 0,
    failure: 0,
    pending: 0,
    failedCheckNames: [],
  };
  const commitNode = raw.commits.nodes?.[0];
  const rollup = commitNode?.commit.statusCheckRollup;
  if (!rollup) return summary;
  for (const ctx of rollup.contexts.nodes ?? []) {
    if (ctx === null) continue;
    summary.total += 1;
    if (ctx.__typename === 'CheckRun') {
      const c = (ctx.conclusion ?? '').toUpperCase();
      if (c === 'SUCCESS' || c === 'NEUTRAL' || c === 'SKIPPED') {
        summary.success += 1;
      } else if (c === 'FAILURE' || c === 'TIMED_OUT' || c === 'CANCELLED' || c === 'ACTION_REQUIRED') {
        summary.failure += 1;
        summary.failedCheckNames.push(ctx.name);
      } else {
        summary.pending += 1;
      }
    } else {
      const s = ctx.state.toUpperCase();
      if (s === 'SUCCESS') summary.success += 1;
      else if (s === 'FAILURE' || s === 'ERROR') {
        summary.failure += 1;
        summary.failedCheckNames.push(ctx.context);
      } else summary.pending += 1;
    }
  }
  return summary;
}

function uniqueLogins(nodes: ReadonlyArray<AuthoredNode> | null | undefined): string[] {
  const seen = new Set<string>();
  for (const node of nodes ?? []) {
    const author = node?.author;
    if (!author || isBotActor(author)) continue;
    seen.add(author.login);
  }
  return [...seen].sort();
}

function isBotActor(actor: Actor): boolean {
  return actor.__typename === 'Bot' || actor.login.endsWith('[bot]');
}
