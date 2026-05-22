import { okAsync, ResultAsync } from "neverthrow";
import type { GithubClient } from "../github/GithubClient.ts";
import type { GithubError } from "../github/errors.ts";
import type { CheckSummary, DependabotPr, PrState } from "../types.ts";

interface GraphqlSearchResponse {
  search: {
    pageInfo: { hasNextPage: boolean; endCursor: string | null };
    nodes: Array<RawPullRequest | null>;
  };
}

interface RawPullRequest {
  number: number;
  title: string;
  state: "OPEN" | "CLOSED" | "MERGED";
  createdAt: string;
  closedAt: string | null;
  mergedAt: string | null;
  url: string;
  baseRefName: string;
  headRefName: string;
  mergedBy: { login: string } | null;
  autoMergeRequest: { enabledAt: string | null } | null;
  repository: { owner: { login: string }; name: string };
  reviews: { nodes: Array<{ author: { login: string } | null } | null> };
  comments: { nodes: Array<{ author: { login: string } | null } | null> };
  commits: {
    nodes: Array<{
      commit: {
        statusCheckRollup: {
          contexts: {
            nodes: Array<
              | { __typename: "CheckRun"; name: string; conclusion: string | null }
              | { __typename: "StatusContext"; context: string; state: string }
              | null
            >;
          };
        } | null;
      };
    } | null>;
  };
}

const SEARCH_QUERY = /* GraphQL */ `
  query DependabotPrs($query: String!, $cursor: String) {
    search(query: $query, type: ISSUE, first: 50, after: $cursor) {
      pageInfo {
        hasNextPage
        endCursor
      }
      nodes {
        ... on PullRequest {
          number
          title
          state
          createdAt
          closedAt
          mergedAt
          url
          baseRefName
          headRefName
          mergedBy {
            login
          }
          autoMergeRequest {
            enabledAt
          }
          repository {
            owner {
              login
            }
            name
          }
          reviews(first: 50) {
            nodes {
              author {
                login
              }
            }
          }
          comments(first: 50) {
            nodes {
              author {
                login
              }
            }
          }
          commits(last: 1) {
            nodes {
              commit {
                statusCheckRollup {
                  contexts(first: 100) {
                    nodes {
                      __typename
                      ... on CheckRun {
                        name
                        conclusion
                      }
                      ... on StatusContext {
                        context
                        state
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  }
`;

export function listDependabotPrs(
  client: GithubClient,
  org: string,
  windowStartIso: string,
): ResultAsync<DependabotPr[], GithubError> {
  const query = [
    `is:pr`,
    `author:app/dependabot`,
    `org:${org}`,
    `updated:>=${windowStartIso.slice(0, 10)}`,
  ].join(" ");
  return pageThrough(client, query, null, []);
}

function pageThrough(
  client: GithubClient,
  query: string,
  cursor: string | null,
  acc: DependabotPr[],
): ResultAsync<DependabotPr[], GithubError> {
  return client.graphql<GraphqlSearchResponse>(SEARCH_QUERY, { query, cursor }).andThen((res) => {
    for (const node of res.search.nodes) {
      if (node === null) continue;
      acc.push(toDependabotPr(node));
    }
    if (res.search.pageInfo.hasNextPage && res.search.pageInfo.endCursor) {
      return pageThrough(client, query, res.search.pageInfo.endCursor, acc);
    }
    return okAsync<DependabotPr[], GithubError>(acc);
  });
}

function toDependabotPr(raw: RawPullRequest): DependabotPr {
  const state: PrState = raw.state === "OPEN" ? "open" : "closed";
  const merged = raw.state === "MERGED";
  const reviewers = uniqueLogins(raw.reviews.nodes.map((n) => n?.author?.login));
  const commenters = uniqueLogins(raw.comments.nodes.map((n) => n?.author?.login));
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
    mergedBy: raw.mergedBy?.login ?? null,
    headRef: raw.headRefName,
    baseRef: raw.baseRefName,
    htmlUrl: raw.url,
    reviewers,
    commenters,
    autoMergeEnabled: raw.autoMergeRequest !== null,
    checks: summarizeChecks(raw),
  };
}

function summarizeChecks(raw: RawPullRequest): CheckSummary {
  const summary: CheckSummary = {
    total: 0,
    success: 0,
    failure: 0,
    pending: 0,
    failedCheckNames: [],
  };
  const commitNode = raw.commits.nodes[0];
  const rollup = commitNode?.commit.statusCheckRollup;
  if (!rollup) return summary;
  for (const ctx of rollup.contexts.nodes) {
    if (ctx === null) continue;
    summary.total += 1;
    if (ctx.__typename === "CheckRun") {
      const c = (ctx.conclusion ?? "").toUpperCase();
      if (c === "SUCCESS" || c === "NEUTRAL" || c === "SKIPPED") {
        summary.success += 1;
      } else if (c === "FAILURE" || c === "TIMED_OUT" || c === "CANCELLED" || c === "ACTION_REQUIRED") {
        summary.failure += 1;
        summary.failedCheckNames.push(ctx.name);
      } else {
        summary.pending += 1;
      }
    } else {
      const s = ctx.state.toUpperCase();
      if (s === "SUCCESS") summary.success += 1;
      else if (s === "FAILURE" || s === "ERROR") {
        summary.failure += 1;
        summary.failedCheckNames.push(ctx.context);
      } else summary.pending += 1;
    }
  }
  return summary;
}

function uniqueLogins(values: Array<string | null | undefined>): string[] {
  const seen = new Set<string>();
  for (const v of values) {
    if (!v) continue;
    if (v.endsWith("[bot]")) continue;
    seen.add(v);
  }
  return [...seen].sort();
}
