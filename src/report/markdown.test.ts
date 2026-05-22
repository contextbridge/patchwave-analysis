import { expect, test } from "bun:test";
import type { ReportBundle } from "./aggregate.ts";
import { renderMarkdown } from "./markdown.ts";

test("renders headline numbers in the executive snapshot", () => {
  const md = renderMarkdown(makeBundle());
  expect(md).toContain("# Dependabot diagnostic — `acme`");
  expect(md).toContain("273");
  expect(md).toContain("102");
  expect(md).toContain("engineer-hours/week");
});

test("renders the scope-missing CVE section when scope is absent", () => {
  const bundle = makeBundle({
    cveStatus: "scope-missing",
    requiredScope: "security_events",
  });
  const md = renderMarkdown(bundle);
  expect(md).toContain("CVE exposure (scope missing)");
  expect(md).toContain("gh auth refresh -s security_events");
});

test("includes recommendations when any are present", () => {
  const bundle = makeBundle();
  bundle.recommendations = [
    { priority: "high", message: "Your oldest open Critical CVE is 95 days old." },
    { priority: "medium", message: "10 repos sitting at the PR cap." },
  ];
  const md = renderMarkdown(bundle);
  expect(md).toContain("High priority");
  expect(md).toContain("Medium priority");
  expect(md).toContain("95 days old");
});

test("renders empty recommendations gracefully", () => {
  const bundle = makeBundle();
  bundle.recommendations = [];
  const md = renderMarkdown(bundle);
  expect(md).toContain("No high-leverage recommendations");
});

function makeBundle(overrides?: { cveStatus?: "ok" | "scope-missing"; requiredScope?: string }): ReportBundle {
  const cveStatus = overrides?.cveStatus ?? "ok";
  return {
    meta: { org: "acme", windowDays: 90, generatedAt: "2026-05-22T00:00:00Z", totalReposScanned: 24 },
    orgOverview: {
      repoCount: 24,
      publicCount: 3,
      privateCount: 21,
      internalCount: 0,
      archivedExcluded: 1,
      topLanguages: [{ language: "TypeScript", bytes: 2_000_000, percentage: 65 }],
      nodeTsRepoCount: 18,
      nodeTsRepoPercentage: 75,
      activeHumanCommitters: 17,
      reposWithBranchProtection: 14,
    },
    dependabotCoverage: {
      reposWithConfig: 20,
      reposWithConfigPercentage: 83.3,
      reposWithSecurityUpdates: 19,
      reposWithSecurityUpdatesPercentage: 79.2,
      ecosystemBreakdown: [{ ecosystem: "npm", repoCount: 18 }],
      packageManagerSplit: [{ manager: "pnpm", repoCount: 12 }, { manager: "yarn", repoCount: 6 }],
    },
    prBacklog: {
      openCount: 102,
      closedInWindowCount: 14,
      mergedInWindowCount: 273,
      openAgeBuckets: [
        { label: "0–30 days", count: 40 },
        { label: "30–60 days", count: 18 },
        { label: "60–90 days", count: 6 },
        { label: "90–180 days", count: 25 },
        { label: "180+ days", count: 13 },
      ],
      oldestOpenDays: 312,
      bumpTypeSplit: [
        { bumpType: "patch", count: 150, percentage: 55 },
        { bumpType: "minor", count: 95, percentage: 34.8 },
        { bumpType: "major", count: 28, percentage: 10.2 },
      ],
      devOnlyShare: { count: 80, percentage: 29.3 },
      ciStatusMix: { green: 50, failing: 30, pending: 22 },
      mechanicalFailureShare: { mechanical: 12, nonMechanical: 18, percentage: 40 },
      timeToMergeP50Days: 2,
      timeToMergeP90Days: 14,
    },
    stalledSignals: {
      reposAtPrCap: [{ repo: "acme/api", openPrs: 7 }],
      reposWithConfigButNoRecentPrs: ["acme/old-tool"],
      revertsInWindow: 4,
      dependabotRevertsInWindow: 1,
      siblingBumps: [],
    },
    people: {
      topMergers: [{ login: "alice", count: 90 }, { login: "bob", count: 60 }],
      topReviewers: [{ login: "alice", count: 12 }],
      topCommenters: [],
      autoMergeInUse: false,
      autoMergePrCount: 0,
    },
    toilCost: {
      mergedInWindow: 273,
      openOver30Days: 62,
      estimatedEngineerMinutesInWindow: 819 + 62,
      estimatedEngineerHoursPerWeek: 1.1,
      estimatedWeeklyCostUsd: 165,
      assumptions: { minutesPerMergedPr: 3, idleMinutesPerStalePr: 1, hourlyRateUsd: 150 },
    },
    cve: cveStatus === "scope-missing"
      ? {
          status: "scope-missing",
          requiredScope: overrides?.requiredScope ?? "security_events",
          totalOpenAlerts: 0,
          bySeverity: { critical: 0, high: 0, medium: 0, low: 0 },
          topReposBySeverity: [],
          oldestCriticalDays: null,
          oldestHighDays: null,
          reposWithSecurityAlertsDisabled: [],
        }
      : {
          status: "ok",
          totalOpenAlerts: 7,
          bySeverity: { critical: 1, high: 3, medium: 2, low: 1 },
          topReposBySeverity: [{ repo: "acme/api", critical: 1, high: 2, medium: 1, low: 0 }],
          oldestCriticalDays: 95,
          oldestHighDays: 200,
          reposWithSecurityAlertsDisabled: [],
        },
    recommendations: [
      { priority: "high", message: "Sample high-priority recommendation." },
    ],
  };
}
