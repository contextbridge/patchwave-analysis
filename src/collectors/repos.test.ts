import { expect, test } from "bun:test";
import { FakeGithubClient } from "../testHelpers/index.ts";
import { getRepoLanguages, listOrgRepos } from "./repos.ts";

test("maps raw repo payloads into RepoMeta and infers visibility", async () => {
  const client = new FakeGithubClient();
  client.onPaginate("GET /orgs/{org}/repos", {}).resolves([
    {
      name: "widgets",
      owner: { login: "acme" },
      private: false,
      visibility: "public",
      archived: false,
      default_branch: "main",
      language: "TypeScript",
      pushed_at: "2026-04-01T00:00:00Z",
      security_and_analysis: { dependabot_security_updates: { status: "enabled" } },
    },
    {
      name: "internal-tool",
      owner: { login: "acme" },
      private: true,
      visibility: "internal",
      archived: true,
      default_branch: "main",
      language: null,
      pushed_at: null,
    },
  ]);

  const result = await listOrgRepos(client, "acme");
  expect(result.isOk()).toBe(true);
  const repos = result._unsafeUnwrap();
  expect(repos).toHaveLength(2);
  expect(repos[0]).toMatchObject({
    owner: "acme",
    name: "widgets",
    visibility: "public",
    archived: false,
    dependabotSecurityUpdates: true,
  });
  expect(repos[1]).toMatchObject({
    visibility: "internal",
    archived: true,
    dependabotSecurityUpdates: null,
  });
});

test("falls back to the user endpoint when the org endpoint 404s", async () => {
  const client = new FakeGithubClient();
  client.onPaginate("GET /orgs/{org}/repos", {}).fails({ kind: "not-found", message: "no org" });
  client.onPaginate("GET /users/{username}/repos", {}).resolves([
    {
      name: "solo",
      owner: { login: "blimmer" },
      private: false,
      visibility: "public",
      archived: false,
      default_branch: "main",
      language: "TypeScript",
      pushed_at: "2026-04-01T00:00:00Z",
    },
  ]);

  const result = await listOrgRepos(client, "blimmer");
  expect(result.isOk()).toBe(true);
  expect(result._unsafeUnwrap()[0]).toMatchObject({ owner: "blimmer", name: "solo" });
});

test("propagates non-404 errors from listOrgRepos", async () => {
  const client = new FakeGithubClient();
  client
    .onPaginate("GET /orgs/{org}/repos", {})
    .fails({ kind: "forbidden", message: "no access" });

  const result = await listOrgRepos(client, "acme");
  expect(result.isErr()).toBe(true);
  expect(result._unsafeUnwrapErr()).toMatchObject({ kind: "forbidden" });
});

test("getRepoLanguages returns bytes keyed by language", async () => {
  const client = new FakeGithubClient();
  client
    .onRequest("GET /repos/{owner}/{repo}/languages", {})
    .resolves({ TypeScript: 1000, JavaScript: 200 });

  const result = await getRepoLanguages(client, { owner: "acme", name: "widgets" });
  expect(result.isOk()).toBe(true);
  expect(result._unsafeUnwrap()).toEqual({
    ref: { owner: "acme", name: "widgets" },
    bytes: { TypeScript: 1000, JavaScript: 200 },
  });
});
