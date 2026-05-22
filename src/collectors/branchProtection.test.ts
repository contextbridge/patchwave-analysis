import { expect, test } from "bun:test";
import { FakeGithubClient } from "../testHelpers/index.ts";
import { getBranchProtection } from "./branchProtection.ts";

test("converts a configured branch into a hasProtection slice", async () => {
  const client = new FakeGithubClient();
  client
    .onRequest("GET /repos/{owner}/{repo}/branches/{branch}/protection", { branch: "main" })
    .resolves({
      required_pull_request_reviews: { required_approving_review_count: 2 },
      required_status_checks: { contexts: ["test"] },
    });

  const result = await getBranchProtection(client, { owner: "acme", name: "widgets" }, "main");
  expect(result.isOk()).toBe(true);
  expect(result._unsafeUnwrap()).toMatchObject({
    owner: "acme",
    name: "widgets",
    hasProtection: true,
    requiredApprovingReviewCount: 2,
    requiresStatusChecks: true,
  });
});

test("treats a 404 as 'no protection configured' rather than an error", async () => {
  const client = new FakeGithubClient();
  client
    .onRequest("GET /repos/{owner}/{repo}/branches/{branch}/protection", {})
    .fails({ kind: "not-found", message: "not found" });

  const result = await getBranchProtection(client, { owner: "acme", name: "widgets" }, "main");
  expect(result.isOk()).toBe(true);
  expect(result._unsafeUnwrap()).toMatchObject({
    hasProtection: false,
    requiredApprovingReviewCount: null,
    requiresStatusChecks: false,
  });
});

test("propagates a non-404 error so the partial-failure boundary can log it", async () => {
  const client = new FakeGithubClient();
  client
    .onRequest("GET /repos/{owner}/{repo}/branches/{branch}/protection", {})
    .fails({ kind: "http", status: 500, message: "boom" });

  const result = await getBranchProtection(client, { owner: "acme", name: "widgets" }, "main");
  expect(result.isErr()).toBe(true);
  expect(result._unsafeUnwrapErr()).toMatchObject({ kind: "http", status: 500 });
});
