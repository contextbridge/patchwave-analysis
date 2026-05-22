import { strToU8, zipSync } from 'fflate';
import type { CollectedData } from '../types.ts';
import type { ReportBundle } from './aggregate.ts';

export interface BundleMeta {
  cliVersion: string;
  generatedAt: string;
  target: string;
  windowDays: number;
  windowStart: string;
  options: {
    include: string[] | null;
    exclude: string[];
  };
  counts: {
    reposTotal: number;
    reposIncluded: number;
    dependabotPrs: number;
    warnings: number;
  };
}

export interface BundleInputs {
  meta: BundleMeta;
  collected: CollectedData;
  aggregated: ReportBundle;
  reportMarkdown: string;
}

export function buildBundleFiles(inputs: BundleInputs): Record<string, string> {
  const { meta, collected, aggregated, reportMarkdown } = inputs;
  return {
    'patchwave-report.md': reportMarkdown,
    'README.txt': sharebackReadme(meta),
    'data/meta.json': stringify(meta),
    'data/repos.json': stringify(collected.repos),
    'data/languages.json': stringify(collected.languages),
    'data/dependabot-config.json': stringify(collected.dependabotConfig),
    'data/dependabot-prs.json': stringify(collected.dependabotPrs),
    'data/cve.json': stringify(collected.cve),
    'data/reverts.json': stringify(collected.reverts),
    'data/branch-protection.json': stringify(collected.branchProtection),
    'data/contributors.json': stringify(collected.contributors),
    'data/warnings.json': stringify(collected.errors),
    'data/aggregated.json': stringify(aggregated),
  };
}

export function zipBundleFiles(files: Record<string, string>): Uint8Array {
  const entries: Record<string, Uint8Array> = {};
  for (const [path, contents] of Object.entries(files)) {
    entries[path] = strToU8(contents);
  }
  return zipSync(entries);
}

function stringify(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function sharebackReadme(meta: BundleMeta): string {
  return [
    `patchwave-analysis bundle`,
    ``,
    `Generated:  ${meta.generatedAt}`,
    `Target:     ${meta.target}`,
    `Window:     ${meta.windowDays} days (since ${meta.windowStart})`,
    `CLI:        v${meta.cliVersion}`,
    ``,
    `Contents:`,
    `  patchwave-report.md       — human-readable report`,
    `  data/meta.json            — run metadata`,
    `  data/aggregated.json      — rolled-up metrics that drive the report`,
    `  data/repos.json           — repo metadata`,
    `  data/languages.json       — per-repo language byte counts`,
    `  data/dependabot-config.json — per-repo Dependabot config + ecosystems`,
    `  data/dependabot-prs.json  — Dependabot PRs in the window (state, checks, reviewers)`,
    `  data/cve.json             — Dependabot security alert slices`,
    `  data/reverts.json         — revert commits detected in the window`,
    `  data/branch-protection.json — default-branch protection slices`,
    `  data/contributors.json    — active human committers per repo`,
    `  data/warnings.json        — per-collector warnings suppressed during the crawl`,
    ``,
    `Sharing this zip with contextbridge gives us the same view the report does plus the raw`,
    `numbers behind every metric. No tokens, secrets, or file contents leave your machine`,
    `unless you choose to share this archive.`,
    ``,
  ].join('\n');
}
