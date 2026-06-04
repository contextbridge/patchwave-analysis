import { ResultAsync, okAsync } from 'neverthrow';
import type { Context } from '../context/index.ts';
import type { Logger } from '../context/Logger.ts';
import { addDays, dateStr, epochDay, midpoint } from '../dates.ts';
import type { GithubError } from '../github/errors.ts';
import { DependabotPrsSearchDocument, type DependabotPrsSearchQuery } from '../github/graphql/generated.ts';
import { type Instant, instantFromString } from '../time.ts';
import type { DependabotPr, PrState, RepoRef } from '../types.ts';
import type { TargetKind } from './repos.ts';

// GitHub's issue/PR search returns at most this many results per query, no matter
// how large `issueCount` is (`hasNextPage` simply stops at the cap). We bisect the
// date range until every sub-query fits under it, so we never silently undercount.
const SEARCH_RESULT_CAP = 1000;

// Open Dependabot PRs can be arbitrarily old, so the open-backlog search spans all
// of history from a fixed floor that predates GitHub-native Dependabot.
const OPEN_PR_FLOOR = instantFromString('2019-01-01T00:00:00Z');

// The Dependabot GitHub App surfaces in GraphQL as a `Bot` actor; unlike the REST
// API it carries no `[bot]` login suffix. We accept both spellings to be safe.
const DEPENDABOT_LOGINS = new Set(['dependabot', 'dependabot[bot]']);

type SearchConnection = DependabotPrsSearchQuery['search'];
type SearchNode = NonNullable<NonNullable<SearchConnection['nodes']>[number]>;
export type PrNode = Extract<SearchNode, { __typename: 'PullRequest' }>;

// GitHub's GraphQL Actor interface, as selected above.
type Actor = NonNullable<PrNode['mergedBy']>;
type AuthoredNode = { author: Actor | null } | null;

interface SearchPage {
  readonly prNodes: PrNode[];
  readonly issueCount: number | null;
  readonly hasNextPage: boolean;
  readonly endCursor: string | null;
}

/**
 * Lists Dependabot PRs via two org-wide GraphQL `search` streams:
 *
 *   - every currently-open Dependabot PR (the backlog, regardless of age), and
 *   - every Dependabot PR closed/merged inside the reporting window (the cost basis).
 *
 * Search is the simplest transport that returns the per-PR review/merge data the
 * cost model needs without per-repo fan-out — but it caps at 1000 results per
 * query, so each stream runs through `searchAllPrs`, which bisects the date range
 * until no sub-query is truncated. Requires a classic token with `repo`; fine-grained
 * tokens silently omit private repos from search (handled by the up-front scope gate).
 */
export function listDependabotPrs(
  ctx: Context,
  target: string,
  targetKind: TargetKind,
  windowStartIso: string,
  nowIso: string,
): ResultAsync<DependabotPr[], GithubError> {
  const scope = targetKind === 'org' ? `org:${target}` : `user:${target}`;
  const today = instantFromString(nowIso);

  const openBacklog = searchAllPrs(
    ctx,
    `is:pr is:open author:app/dependabot ${scope}`,
    'created',
    OPEN_PR_FLOOR,
    today,
  );
  const resolvedInWindow = searchAllPrs(
    ctx,
    `is:pr author:app/dependabot ${scope}`,
    'closed',
    instantFromString(windowStartIso),
    today,
  );

  return ResultAsync.combine([openBacklog, resolvedInWindow]).map(([open, resolved]) =>
    [...open, ...resolved].filter(isDependabotPr).map(toDependabotPr),
  );
}

// Collects every PR in [start, end] for `dateField`, bisecting the range whenever a
// query would exceed the 1000-result cap so the union is complete.
function searchAllPrs(
  ctx: Context,
  baseQuery: string,
  dateField: 'created' | 'closed',
  start: Instant,
  end: Instant,
): ResultAsync<PrNode[], GithubError> {
  const { logger } = ctx;
  const query = `${baseQuery} ${dateField}:${dateStr(start)}..${dateStr(end)}`;

  return searchPage(ctx, query, null).andThen((first) => {
    const overCap = first.issueCount !== null && first.issueCount > SEARCH_RESULT_CAP;
    if (overCap && epochDay(start) < epochDay(end)) {
      const mid = midpoint(start, end);
      const left = searchAllPrs(ctx, baseQuery, dateField, start, mid);
      const right = searchAllPrs(ctx, baseQuery, dateField, addDays(mid, 1), end);
      return ResultAsync.combine([left, right]).map(([a, b]) => [...a, ...b]);
    }
    if (overCap) {
      // A single day with >1000 matches can't be subdivided — we keep what the cap
      // allows but surface it so we know the report may undercount this date.
      logger.error(
        { dateField, day: dateStr(start), issueCount: first.issueCount },
        'GitHub search returned more than 1000 results for a single day; results for that day are truncated',
      );
    }
    return pageRest(ctx, query, first).map((nodes) => {
      if (first.issueCount !== null && first.issueCount > 0 && nodes.length === 0) {
        logger.error(
          { query, issueCount: first.issueCount },
          'GitHub search reported results but none were retrievable; treating the page as empty',
        );
      }
      return nodes;
    });
  });
}

// Walks the remaining pages of a single range starting from an already-fetched first page.
function pageRest(ctx: Context, query: string, first: SearchPage): ResultAsync<PrNode[], GithubError> {
  const acc = [...first.prNodes];
  const step = (cursor: string): ResultAsync<PrNode[], GithubError> =>
    searchPage(ctx, query, cursor).andThen((page) => {
      acc.push(...page.prNodes);
      if (page.hasNextPage && page.endCursor) return step(page.endCursor);
      return okAsync<PrNode[], GithubError>(acc);
    });
  if (first.hasNextPage && first.endCursor) return step(first.endCursor);
  return okAsync<PrNode[], GithubError>(acc);
}

function searchPage(ctx: Context, query: string, cursor: string | null): ResultAsync<SearchPage, GithubError> {
  const { githubClient, logger } = ctx;
  // The GraphQL variable is `searchQuery`, not `query`: Octokit reserves `query`
  // as a request-option name and rejects it as a variable.
  return githubClient
    .graphql(DependabotPrsSearchDocument, { searchQuery: query, cursor })
    .map((res) => parsePage(logger, res, query));
}

// Reads a search response defensively. GitHub omits `search`/`nodes` or returns null
// leaves on timeouts and partial responses even though codegen types them non-null,
// so every level is guarded; an absent payload is logged (reported) and treated as an
// empty page rather than dereferenced into a crash.
function parsePage(logger: Logger, res: DependabotPrsSearchQuery, query: string): SearchPage {
  const search = (res as { search?: SearchConnection | null }).search;
  if (search == null) {
    logger.error({ query }, 'GitHub search returned no `search` payload; treating the page as empty');
    return { prNodes: [], issueCount: null, hasNextPage: false, endCursor: null };
  }
  const rawNodes = Array.isArray(search.nodes) ? search.nodes : [];
  const prNodes: PrNode[] = [];
  for (const node of rawNodes) {
    if (!isPrNode(node)) continue;
    if (repoRefOf(node) === null) {
      logger.error({ query, number: node.number }, 'search returned a PullRequest with no repository; skipping it');
      continue;
    }
    prNodes.push(node);
  }
  const pageInfo = search.pageInfo as { hasNextPage?: boolean; endCursor?: string | null } | null | undefined;
  return {
    prNodes,
    issueCount: typeof search.issueCount === 'number' ? search.issueCount : null,
    hasNextPage: pageInfo?.hasNextPage ?? false,
    endCursor: pageInfo?.endCursor ?? null,
  };
}

function isPrNode(node: SearchNode | null): node is PrNode {
  return node?.__typename === 'PullRequest';
}

function isDependabotPr(node: PrNode): boolean {
  const author = node.author;
  return author != null && author.__typename === 'Bot' && DEPENDABOT_LOGINS.has(author.login);
}

function toDependabotPr(raw: PrNode): DependabotPr {
  const repo = repoRefOf(raw) as RepoRef; // non-null: parsePage dropped nodes without a repo
  const state: PrState = raw.state === 'OPEN' ? 'open' : 'closed';
  const merged = raw.state === 'MERGED';
  return {
    owner: repo.owner,
    name: repo.name,
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
  };
}

// Reads the repository owner/name from a PR node, tolerating the null/missing leaves
// a partial GraphQL response can produce despite the non-null codegen types.
function repoRefOf(node: PrNode): RepoRef | null {
  const repo = node.repository as { name?: unknown; owner?: { login?: unknown } | null } | null | undefined;
  const name = repo?.name;
  const login = repo?.owner?.login;
  if (typeof name !== 'string' || typeof login !== 'string') return null;
  return { owner: login, name };
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
