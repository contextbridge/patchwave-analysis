import { expect, test } from "bun:test";
import { FakeGithubClient } from "../testHelpers/index.ts";
import { getDependabotConfig } from "./dependabotConfig.ts";

function base64(text: string): string {
  return Buffer.from(text, "utf8").toString("base64");
}

test("parses ecosystems from a dependabot.yml and detects pnpm lockfile", async () => {
  const client = new FakeGithubClient();
  client
    .onRequest("GET /repos/{owner}/{repo}/contents/{path}", { path: ".github/dependabot.yml" })
    .resolves({
      content: base64(`
version: 2
updates:
  - package-ecosystem: "npm"
    directory: "/"
  - package-ecosystem: "github-actions"
    directory: "/"
      `),
      encoding: "base64",
    });
  client
    .onRequest("GET /repos/{owner}/{repo}/contents/{path}", { path: "pnpm-lock.yaml" })
    .resolves({ content: base64(""), encoding: "base64" });

  const result = await getDependabotConfig(client, { owner: "acme", name: "widgets" });
  expect(result.isOk()).toBe(true);
  expect(result._unsafeUnwrap()).toMatchObject({
    hasConfig: true,
    ecosystems: ["github-actions", "npm"],
    packageManager: "pnpm",
  });
});

test("falls back to dependabot.yaml when .yml is absent", async () => {
  const client = new FakeGithubClient();
  client
    .onRequest("GET /repos/{owner}/{repo}/contents/{path}", { path: ".github/dependabot.yml" })
    .fails({ kind: "not-found", message: "no .yml" });
  client
    .onRequest("GET /repos/{owner}/{repo}/contents/{path}", { path: ".github/dependabot.yaml" })
    .resolves({
      content: base64(`updates:\n  - package-ecosystem: bundler\n`),
      encoding: "base64",
    });
  client
    .onRequest("GET /repos/{owner}/{repo}/contents/{path}", { path: "pnpm-lock.yaml" })
    .fails({ kind: "not-found", message: "no lock" });
  client
    .onRequest("GET /repos/{owner}/{repo}/contents/{path}", { path: "yarn.lock" })
    .fails({ kind: "not-found", message: "no lock" });
  client
    .onRequest("GET /repos/{owner}/{repo}/contents/{path}", { path: "bun.lockb" })
    .fails({ kind: "not-found", message: "no lock" });
  client
    .onRequest("GET /repos/{owner}/{repo}/contents/{path}", { path: "package-lock.json" })
    .fails({ kind: "not-found", message: "no lock" });

  const result = await getDependabotConfig(client, { owner: "acme", name: "widgets" });
  expect(result.isOk()).toBe(true);
  expect(result._unsafeUnwrap()).toMatchObject({
    hasConfig: true,
    ecosystems: ["bundler"],
    packageManager: null,
  });
});

test("returns hasConfig: false when both paths 404 but the call still succeeds", async () => {
  const client = new FakeGithubClient();
  for (const path of [".github/dependabot.yml", ".github/dependabot.yaml"]) {
    client
      .onRequest("GET /repos/{owner}/{repo}/contents/{path}", { path })
      .fails({ kind: "not-found", message: "no config" });
  }
  for (const path of ["pnpm-lock.yaml", "yarn.lock", "bun.lockb", "package-lock.json"]) {
    client
      .onRequest("GET /repos/{owner}/{repo}/contents/{path}", { path })
      .fails({ kind: "not-found", message: "no lock" });
  }

  const result = await getDependabotConfig(client, { owner: "acme", name: "widgets" });
  expect(result.isOk()).toBe(true);
  expect(result._unsafeUnwrap()).toMatchObject({
    hasConfig: false,
    ecosystems: [],
    packageManager: null,
  });
});

test("propagates non-404 errors when fetching the config", async () => {
  const client = new FakeGithubClient();
  client
    .onRequest("GET /repos/{owner}/{repo}/contents/{path}", { path: ".github/dependabot.yml" })
    .fails({ kind: "forbidden", message: "no access" });

  const result = await getDependabotConfig(client, { owner: "acme", name: "widgets" });
  expect(result.isErr()).toBe(true);
  expect(result._unsafeUnwrapErr()).toMatchObject({ kind: "forbidden" });
});
