import { ResultAsync, errAsync, okAsync } from 'neverthrow';
import pMap from 'p-map';
import type { GithubError } from '../github/errors.ts';
import type { GithubClient } from '../github/GithubClient.ts';
import { DependabotPrsBatchDocument, type DependabotPrsBatchQuery } from '../github/graphql/generated.ts';
import type { DependabotPr, PrState, RepoMeta, RepoRef } from '../types.ts';

// How many repos to ask for per GraphQL request. PR nodes carry nested reviews
// and comments, so we stay below the `repoMetadata` batch size to avoid GitHub
// resolver timeouts (502/504) on PR-busy orgs.
const BATCH_SIZE = 10;
const BATCH_CONCURRENCY = 5;
const FOLLOWUP_CONCURRENCY = 5;

// The Dependabot GitHub App surfaces in GraphQL as a `Bot` actor; unlike the
// REST API it carries no `[bot]` login suffix. We accept both spellings to be safe.
const DEPENDABOT_LOGINS = new Set(['dependabot', 'dependabot[bot]']);

type RepoNode = Extract<NonNullable<DependabotPrsBatchQuery['nodes'][number]>, { __typename: 'Repository' }>;
type PrConnection = RepoNode['pullRequests'];
export type PrNode = NonNullable<NonNullable<PrConnection['nodes']>[number]>;

// GitHub's GraphQL Actor interface, as selected above.
type Actor = NonNullable<PrNode['mergedBy']>;
type AuthoredNode = { author: Actor | null } | null;

/**
 * Lists Dependabot PRs across the window by walking each repo's `pullRequests`
 * connection in batched GraphQL queries.
 *
 * We deliberately avoid the `search` API: it silently returns nothing for
 * private repos under a fine-grained token (no error, just empty), which would
 * surface as a confident $0. Direct repo access via `nodes(ids: …)` works with
 * fine-grained tokens, and batching keeps us off the per-repo REST path that
 * blew past rate limits (see PR #29).
 */
export function listDependabotPrs(
  client: GithubClient,
  repos: readonly RepoMeta[],
  windowStartIso: string,
): ResultAsync<DependabotPr[], GithubError> {
  const batches = chunk(repos, BATCH_SIZE);
  if (batches.length === 0) return okAsync<DependabotPr[], GithubError>([]);

  return ResultAsync.fromSafePromise(
    pMap(batches, (batch) => Promise.resolve(collectBatch(client, batch, windowStartIso)), {
      concurrency: BATCH_CONCURRENCY,
    }),
  ).andThen((results) => {
    // Partial failure is tolerated (one heavy batch shouldn't zero the report),
    // but a total wipeout propagates so the caller records a real warning.
    const firstError = results.find((r) => r.isErr());
    if (firstError && firstError.isErr() && results.every((r) => r.isErr())) {
      return errAsync<DependabotPr[], GithubError>(firstError.error);
    }
    return okAsync<DependabotPr[], GithubError>(results.flatMap((r) => (r.isOk() ? r.value : [])));
  });
}

function collectBatch(
  client: GithubClient,
  repos: readonly RepoMeta[],
  windowStartIso: string,
): ResultAsync<DependabotPr[], GithubError> {
  const ids = repos.map((r) => r.nodeId);
  return client.graphql(DependabotPrsBatchDocument, { ids, cursor: null }).andThen((res) => {
    const prs: DependabotPr[] = [];
    const followups: Array<{ id: string; cursor: string }> = [];
    for (const node of repoNodesOf(res)) {
      if (!isRepoNode(node)) continue;
      const repo: RepoRef = { owner: node.owner.login, name: node.name };
      const { hasMore, endCursor } = collectConnection(node.pullRequests, repo, windowStartIso, prs);
      if (hasMore && endCursor) followups.push({ id: node.id, cursor: endCursor });
    }
    if (followups.length === 0) return okAsync<DependabotPr[], GithubError>(prs);

    // A few repos have more in-window PRs than one page holds; page just those.
    return ResultAsync.fromSafePromise(
      pMap(followups, (f) => Promise.resolve(pageRepo(client, f.id, f.cursor, windowStartIso)), {
        concurrency: FOLLOWUP_CONCURRENCY,
      }),
    ).map((moreResults) => {
      for (const r of moreResults) if (r.isOk()) prs.push(...r.value);
      return prs;
    });
  });
}

function pageRepo(
  client: GithubClient,
  id: string,
  startCursor: string,
  windowStartIso: string,
): ResultAsync<DependabotPr[], GithubError> {
  const acc: DependabotPr[] = [];
  const step = (cursor: string): ResultAsync<DependabotPr[], GithubError> =>
    // A single-id `nodes` query lets us reuse one document; the shared `$cursor`
    // is unambiguous because there's exactly one connection in play.
    client.graphql(DependabotPrsBatchDocument, { ids: [id], cursor }).andThen((res) => {
      const node = repoNodesOf(res).find(isRepoNode);
      if (!node) return okAsync<DependabotPr[], GithubError>(acc);
      const repo: RepoRef = { owner: node.owner.login, name: node.name };
      const { hasMore, endCursor } = collectConnection(node.pullRequests, repo, windowStartIso, acc);
      if (hasMore && endCursor) return step(endCursor);
      return okAsync<DependabotPr[], GithubError>(acc);
    });
  return step(startCursor);
}

// Walks one page of a repo's PRs (ordered by `updatedAt` desc), appending the
// Dependabot-authored ones inside the window. Returns whether more pages are
// worth fetching — false once we cross the window edge, since the rest are older.
function collectConnection(
  connection: PrConnection,
  repo: RepoRef,
  windowStartIso: string,
  acc: DependabotPr[],
): { hasMore: boolean; endCursor: string | null } {
  let reachedWindowEdge = false;
  for (const node of connection.nodes ?? []) {
    if (!node) continue;
    if (node.updatedAt < windowStartIso) {
      reachedWindowEdge = true;
      break;
    }
    if (isDependabotPr(node)) acc.push(toDependabotPr(node, repo));
  }
  return {
    hasMore: !reachedWindowEdge && connection.pageInfo.hasNextPage,
    endCursor: connection.pageInfo.endCursor ?? null,
  };
}

// Partial responses (a forbidden field, a resolver timeout) can leave `nodes`
// missing even when the call resolves, so read it defensively rather than
// trusting the non-null type and crashing the whole crawl.
function repoNodesOf(res: DependabotPrsBatchQuery): DependabotPrsBatchQuery['nodes'] {
  const nodes = (res as { nodes?: DependabotPrsBatchQuery['nodes'] }).nodes;
  return Array.isArray(nodes) ? nodes : [];
}

function isRepoNode(node: DependabotPrsBatchQuery['nodes'][number]): node is RepoNode {
  return node?.__typename === 'Repository';
}

function isDependabotPr(node: PrNode): boolean {
  const author = node.author;
  return author != null && author.__typename === 'Bot' && DEPENDABOT_LOGINS.has(author.login);
}

function toDependabotPr(raw: PrNode, repo: RepoRef): DependabotPr {
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

function chunk<T>(items: readonly T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}
