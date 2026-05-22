import { expect, test } from "bun:test";
import { FakeGithubClient } from "../testHelpers/index.ts";
import { listDependabotPrs } from "./dependabotPrs.ts";

function rawPr(overrides: Partial<RawPullRequest> = {}): RawPullRequest {
  return {
    number: 1,
    title: "Bump lodash from 4.17.20 to 4.17.21",
    state: "OPEN",
    createdAt: "2026-04-01T00:00:00Z",
    closedAt: null,
    mergedAt: null,
    url: "https://github.com/acme/widgets/pull/1",
    baseRefName: "main",
    headRefName: "dependabot/npm_and_yarn/lodash-4.17.21",
    mergedBy: null,
    autoMergeRequest: null,
    repository: { owner: { login: "acme" }, name: "widgets" },
    reviews: { nodes: [] },
    comments: { nodes: [] },
    commits: { nodes: [{ commit: { statusCheckRollup: null } }] },
    ...overrides,
  };
}

// Local mirror of the GraphQL shape — the production interface is internal.
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
  commits: { nodes: Array<{ commit: { statusCheckRollup: unknown } } | null> };
}

test("maps a single page of search results to DependabotPr", async () => {
  const client = new FakeGithubClient();
  client.onGraphql("DependabotPrs").resolves({
    search: {
      pageInfo: { hasNextPage: false, endCursor: null },
      nodes: [
        rawPr({
          state: "MERGED",
          mergedAt: "2026-04-05T00:00:00Z",
          mergedBy: { login: "alice" },
          reviews: { nodes: [{ author: { login: "bob" } }, { author: { login: "alice" } }] },
          comments: { nodes: [{ author: { login: "alice" } }] },
        }),
      ],
    },
  });

  const result = await listDependabotPrs(client, "acme", "2026-01-01T00:00:00Z");
  expect(result.isOk()).toBe(true);
  const prs = result._unsafeUnwrap();
  expect(prs).toHaveLength(1);
  expect(prs[0]).toMatchObject({
    owner: "acme",
    name: "widgets",
    state: "closed",
    merged: true,
    mergedBy: "alice",
    reviewers: ["alice", "bob"],
    commenters: ["alice"],
  });
});

test("pages through results when hasNextPage is true", async () => {
  const client = new FakeGithubClient();
  // First page returns cursor; second returns no more.
  client.onGraphql((_q, vars) => vars.cursor === null).resolves({
    search: {
      pageInfo: { hasNextPage: true, endCursor: "CURSOR_1" },
      nodes: [rawPr({ number: 1 })],
    },
  });
  client.onGraphql((_q, vars) => vars.cursor === "CURSOR_1").resolves({
    search: {
      pageInfo: { hasNextPage: false, endCursor: null },
      nodes: [rawPr({ number: 2 })],
    },
  });

  const result = await listDependabotPrs(client, "acme", "2026-01-01T00:00:00Z");
  expect(result.isOk()).toBe(true);
  expect(result._unsafeUnwrap().map((p) => p.number)).toEqual([1, 2]);
  expect(client.callsTo("graphql")).toHaveLength(2);
});

test("propagates errors from the GraphQL call", async () => {
  const client = new FakeGithubClient();
  client.onGraphql("DependabotPrs").fails({ kind: "forbidden", message: "no access" });

  const result = await listDependabotPrs(client, "acme", "2026-01-01T00:00:00Z");
  expect(result.isErr()).toBe(true);
});
