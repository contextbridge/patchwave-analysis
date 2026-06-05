import {
  collectedData,
  collectionContext,
  cveAlert,
  cveSliceOk,
  dependabotPr,
  repoMeta,
} from '../../../testFactories.ts';
import { instantFromString } from '../../../time.ts';
import type { CollectedData, CveSlice, DependabotPr, RepoMeta } from '../../../types.ts';
import { aggregate } from '../../aggregate.ts';
import { toEmbeddedShape } from '../../embeddedShape.ts';
import type { EmbeddedReportData } from '../types.ts';

// Inputs for a synthetic "sample" report, exposed as Storybook controls. `repos` is the
// real cost driver; `engineers` only seeds a default repo count (~6/repo). Per-repo rates
// are calibrated to real PatchWave runs (~2.5 human merges/repo/quarter, ~0 reviews, so a
// 120-repo org lands near ~$48k/yr). Minutes/PR and $/hr are left at the report's defaults
// ($12/200) and adjusted live via the report's own "Adjust" affordance, not story knobs.
export interface SampleInputs {
  orgName: string;
  engineers: number;
  repos: number;
}

export const sampleDefaults: SampleInputs = {
  orgName: 'Your Company',
  engineers: 20,
  repos: 0, // 0 → seed from engineers
};

export function buildSampleReport(inputs: SampleInputs): EmbeddedReportData {
  return toEmbeddedShape(aggregate(buildCollectedData(inputs)));
}

// An explicit `repos` override wins; otherwise seed from engineers.
export function resolveRepoCount(inputs: SampleInputs): number {
  const repos = inputs.repos > 0 ? inputs.repos : inputs.engineers * REPOS_PER_ENGINEER_SEED;
  return clampInt(repos, 1, MAX_REPOS);
}

// Fixed window ending on a pinned instant — no Date/random — so output is deterministic
// for a given input (stable Chromatic snapshots).
const SAMPLE_NOW = instantFromString('2026-05-22T00:00:00Z');
const MAX_REPOS = 6000; // guardrail so a huge value can't hang the browser

const REPOS_PER_ENGINEER_SEED = 6;
const MERGED_PRS_PER_REPO = 2.5; // human merges/repo/quarter — the cost driver
const OPEN_PRS_PER_REPO = 0.7; // aging backlog
const CLOSED_PRS_PER_REPO = 1.5; // closed/superseded without merge
const MERGER_TEAM_SIZE = 3; // a small "goalie" team does the merging

const LANGUAGES = ['TypeScript', 'TypeScript', 'TypeScript', 'Python', 'JavaScript', 'Go', 'Ruby', 'Java'];
const REPO_BASENAMES = [
  'api',
  'web',
  'worker',
  'billing',
  'auth',
  'mobile',
  'docs',
  'infra',
  'gateway',
  'admin',
  'search',
  'payments',
];
const PR_TITLES = [
  'Bump the npm group with 5 updates', // grouped
  'Bump react from 18.2.0 to 18.3.0', // minor
  'Bump express from 4.18.2 to 5.0.0', // major
  'Bump lodash from 4.17.20 to 4.17.21', // patch
  'Bump eslint from 8.56.0 to 8.57.0 (deps-dev)', // dev
];
const ALERT_SEVERITIES = ['high', 'medium', 'critical', 'high', 'medium', 'low'] as const;

function buildCollectedData(inputs: SampleInputs): CollectedData {
  const owner = slugify(inputs.orgName);
  const repoCount = resolveRepoCount(inputs);
  const repos = buildRepos(owner, repoCount);

  const merged = Math.round(repoCount * MERGED_PRS_PER_REPO);
  const open = Math.round(repoCount * OPEN_PRS_PER_REPO);
  const closed = Math.round(repoCount * CLOSED_PRS_PER_REPO);

  return collectedData.build({
    ctx: collectionContext.build({ org: inputs.orgName }),
    repos,
    dependabotPrs: buildPrs(owner, repos, merged, open, closed),
    cve: buildCve(owner, repos),
    errors: [],
  });
}

function buildRepos(owner: string, count: number): RepoMeta[] {
  return Array.from({ length: count }, (_, i) =>
    repoMeta.build({
      owner,
      name: repoName(i),
      nodeId: `R_sample_${i}`,
      visibility: i % 6 === 0 ? 'public' : 'private',
      primaryLanguage: LANGUAGES[i % LANGUAGES.length] ?? 'TypeScript',
      dependabotSecurityUpdates: i % 5 !== 0,
    }),
  );
}

function buildPrs(
  owner: string,
  repos: readonly RepoMeta[],
  merged: number,
  open: number,
  closed: number,
): DependabotPr[] {
  const prs: DependabotPr[] = [];
  let seq = 0;
  const nextRepoName = () => repos[seq % repos.length]?.name ?? 'api';

  // Merged: skewed across a small fixed team, no separate reviewers (matches real runs).
  const perMerger = distributeSkewed(merged, Math.min(MERGER_TEAM_SIZE, Math.max(1, merged)));
  perMerger.forEach((count, i) => {
    for (let c = 0; c < count; c++) {
      const age = 2 + (seq % 84);
      prs.push(
        basePr(owner, nextRepoName(), seq, {
          state: 'closed',
          merged: true,
          createdAt: daysAgoIso(age),
          mergedAt: daysAgoIso(Math.max(0, age - (seq % 3))),
          closedAt: daysAgoIso(Math.max(0, age - (seq % 3))),
          mergedBy: `eng-${String(i + 1).padStart(2, '0')}`,
        }),
      );
      seq++;
    }
  });

  // Open: ages spread across the report's buckets, including a 90+ tail.
  for (let c = 0; c < open; c++) {
    prs.push(
      basePr(owner, nextRepoName(), seq, {
        state: 'open',
        createdAt: daysAgoIso(openAgeDays(seq)),
      }),
    );
    seq++;
  }

  // Closed without merging.
  for (let c = 0; c < closed; c++) {
    const age = 20 + (seq % 60);
    prs.push(
      basePr(owner, nextRepoName(), seq, {
        state: 'closed',
        createdAt: daysAgoIso(age),
        closedAt: daysAgoIso(age - 5),
      }),
    );
    seq++;
  }

  return prs;
}

function buildCve(owner: string, repos: readonly RepoMeta[]): CveSlice[] {
  return repos.map((r, i): CveSlice => {
    if (i % 6 === 5) return { owner, name: r.name, status: 'not-enabled' };
    const count = ALERT_COUNTS[i % ALERT_COUNTS.length] ?? 0;
    const alerts = Array.from({ length: count }, (_, k) =>
      cveAlert.build({
        owner,
        name: r.name,
        number: k + 1,
        severity: ALERT_SEVERITIES[(i + k) % ALERT_SEVERITIES.length] ?? 'medium',
        createdAt: daysAgoIso(15 + ((i * 7 + k) % 300)),
      }),
    );
    return cveSliceOk.build({ owner, name: r.name, alerts });
  });
}
const ALERT_COUNTS = [0, 2, 1, 4, 0, 3, 6, 1];

function basePr(owner: string, name: string, seq: number, over: Partial<DependabotPr>): DependabotPr {
  return dependabotPr.build({
    owner,
    name,
    number: seq + 1,
    title: PR_TITLES[seq % PR_TITLES.length] ?? 'Bump a dependency to a newer version',
    htmlUrl: `https://github.com/${owner}/${name}/pull/${seq + 1}`,
    ...over,
  });
}

// Skew so the top merger bears most of the load (harmonic weights: 1, 1/2, 1/3, …).
function distributeSkewed(total: number, n: number): number[] {
  if (n <= 0 || total <= 0) return Array.from({ length: Math.max(0, n) }, () => 0);
  const weights = Array.from({ length: n }, (_, i) => 1 / (i + 1));
  const sum = weights.reduce((a, b) => a + b, 0);
  const counts = weights.map((w) => Math.floor((total * w) / sum));
  let leftover = total - counts.reduce((a, b) => a + b, 0);
  for (let i = 0; leftover > 0; i = (i + 1) % n) {
    counts[i] = (counts[i] ?? 0) + 1;
    leftover--;
  }
  return counts;
}

function repoName(i: number): string {
  const base = REPO_BASENAMES[i % REPO_BASENAMES.length] ?? 'service';
  const cycle = Math.floor(i / REPO_BASENAMES.length);
  return cycle === 0 ? base : `${base}-${cycle + 1}`;
}

const OPEN_AGE_BUCKETS = [12, 45, 75, 100]; // 0–30 / 30–60 / 60–90 / 90+ buckets
function openAgeDays(k: number): number {
  return (OPEN_AGE_BUCKETS[k % OPEN_AGE_BUCKETS.length] ?? 12) + (k % 18);
}

function daysAgoIso(days: number): string {
  return SAMPLE_NOW.subtract({ hours: Math.max(0, Math.round(days)) * 24 }).toString();
}

function slugify(name: string): string {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug.length > 0 ? slug : 'sample-org';
}

function clampInt(n: number, min: number, max: number): number {
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, Math.round(n)));
}
