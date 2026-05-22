import { expect, test } from "bun:test";
import { isLikelyMechanicalFailure, summarizeMechanicalFailures } from "./mechanicalFailure.ts";

test("flags lockfile-related check names", () => {
  expect(isLikelyMechanicalFailure("install dependencies")).toBe(true);
  expect(isLikelyMechanicalFailure("validate package-lock.json")).toBe(true);
  expect(isLikelyMechanicalFailure("pnpm-lock integrity")).toBe(true);
  expect(isLikelyMechanicalFailure("yarn.lock check")).toBe(true);
});

test("does not flag generic test/build failures", () => {
  expect(isLikelyMechanicalFailure("test (unit)")).toBe(false);
  expect(isLikelyMechanicalFailure("typecheck")).toBe(false);
});

test("summarizes a list", () => {
  const result = summarizeMechanicalFailures([
    "test (unit)",
    "install dependencies",
    "lockfile check",
  ]);
  expect(result.mechanical).toBe(2);
  expect(result.nonMechanical).toBe(1);
  expect(result.matched).toEqual(["install dependencies", "lockfile check"]);
});
