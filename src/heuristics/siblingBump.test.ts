import { expect, test } from "bun:test";
import type { DependabotPr } from "../types.ts";
import { extractPackageNameFromHeadRef, findSiblingBumps } from "./siblingBump.ts";

test("extracts package name from canonical head ref", () => {
  expect(extractPackageNameFromHeadRef("dependabot/npm_and_yarn/lodash-4.17.21")).toBe("lodash");
});

test("extracts package name from scoped package head ref", () => {
  expect(extractPackageNameFromHeadRef("dependabot/npm_and_yarn/types/node-18.0.1")).toBe("node");
});

test("returns null for non-dependabot refs", () => {
  expect(extractPackageNameFromHeadRef("feat/something")).toBeNull();
});

test("groups multiple open PRs targeting the same dependency in one repo", () => {
  const prs = [
    makePr({ owner: "acme", name: "app", number: 1, headRef: "dependabot/npm_and_yarn/lodash-4.17.21" }),
    makePr({ owner: "acme", name: "app", number: 2, headRef: "dependabot/npm_and_yarn/lodash-4.17.22" }),
    makePr({ owner: "acme", name: "app", number: 3, headRef: "dependabot/npm_and_yarn/react-18.3.0" }),
  ];
  const groups = findSiblingBumps(prs);
  expect(groups).toHaveLength(1);
  expect(groups[0]?.packageName).toBe("lodash");
  expect(groups[0]?.prNumbers).toEqual([1, 2]);
});

test("ignores merged/closed PRs", () => {
  const prs = [
    makePr({ owner: "acme", name: "app", number: 1, headRef: "dependabot/npm_and_yarn/lodash-4.17.21" }),
    makePr({
      owner: "acme",
      name: "app",
      number: 2,
      headRef: "dependabot/npm_and_yarn/lodash-4.17.22",
      state: "closed",
    }),
  ];
  expect(findSiblingBumps(prs)).toHaveLength(0);
});

function makePr(overrides: Partial<DependabotPr> & Pick<DependabotPr, "owner" | "name" | "number" | "headRef">): DependabotPr {
  return {
    owner: overrides.owner,
    name: overrides.name,
    number: overrides.number,
    title: overrides.title ?? `Bump ${overrides.headRef}`,
    state: overrides.state ?? "open",
    merged: overrides.merged ?? false,
    createdAt: overrides.createdAt ?? "2026-01-01T00:00:00Z",
    closedAt: overrides.closedAt ?? null,
    mergedAt: overrides.mergedAt ?? null,
    mergedBy: overrides.mergedBy ?? null,
    headRef: overrides.headRef,
    baseRef: overrides.baseRef ?? "main",
    htmlUrl: overrides.htmlUrl ?? "",
    reviewers: overrides.reviewers ?? [],
    commenters: overrides.commenters ?? [],
    autoMergeEnabled: overrides.autoMergeEnabled ?? false,
    checks: overrides.checks ?? { total: 0, success: 0, failure: 0, pending: 0, failedCheckNames: [] },
  };
}
