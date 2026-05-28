import { Result, ResultAsync, okAsync } from 'neverthrow';
import pMap from 'p-map';
import { type GithubError, formatGithubError } from '../github/errors.ts';
import type { GithubClient } from '../github/GithubClient.ts';
import {
  RepoMetadataBatchDocument,
  type RepoMetadataBatchQuery,
  type RepoMetadataBatchQueryVariables,
} from '../github/graphql/generated.ts';
import type {
  BranchProtectionSlice,
  BranchProtectionSource,
  CollectorWarning,
  DependabotConfigSlice,
  DependabotInterval,
  DependabotUpdateEntry,
  RepoMeta,
  RepoRef,
} from '../types.ts';

export const BATCH_SIZE = 20;
const REPO_METADATA_BATCH_CONCURRENCY = 5;
const DEFAULT_OPEN_PR_LIMIT = 5;

export interface RepoMetadataResult {
  readonly dependabotConfig: DependabotConfigSlice[];
  readonly branchProtection: BranchProtectionSlice[];
  readonly warnings: CollectorWarning[];
}

type RepoNode = Extract<NonNullable<RepoMetadataBatchQuery['nodes'][number]>, { __typename: 'Repository' }>;

/**
 * Fetches Dependabot config + branch protection for every repo via batched
 * GraphQL queries. Partial failures stay inside `result.value.warnings`; the
 * outer Err channel is reserved for systemic errors and is currently unused
 * (every batch swallows its own error). Callers should not double-account by
 * also pushing the outer error into a top-level warnings list.
 */
export function listRepoMetadataBatched(
  client: GithubClient,
  repos: readonly RepoMeta[],
): ResultAsync<RepoMetadataResult, GithubError> {
  const batches = chunk(repos, BATCH_SIZE);
  const empty: RepoMetadataResult = { dependabotConfig: [], branchProtection: [], warnings: [] };
  if (batches.length === 0) return okAsync(empty);

  return ResultAsync.fromSafePromise(
    pMap(
      batches,
      async (batch): Promise<RepoMetadataResult> => {
        const result = await runBatch(client, batch);
        if (result.isOk()) return result.value;
        return batchFailure(batch, formatGithubError(result.error));
      },
      { concurrency: REPO_METADATA_BATCH_CONCURRENCY },
    ),
  ).map((batchResults) =>
    batchResults.reduce<RepoMetadataResult>((acc, cur) => {
      acc.dependabotConfig.push(...cur.dependabotConfig);
      acc.branchProtection.push(...cur.branchProtection);
      acc.warnings.push(...cur.warnings);
      return acc;
    }, empty),
  );
}

function runBatch(client: GithubClient, repos: readonly RepoMeta[]): ResultAsync<RepoMetadataResult, GithubError> {
  const variables = buildVariables(repos);
  return client
    .graphql(RepoMetadataBatchDocument, variables)
    .map((res): RepoMetadataResult => parseBatchResponse(res, repos))
    .orElse((err) => {
      return okAsync<RepoMetadataResult, GithubError>(batchFailure(repos, formatGithubError(err)));
    });
}

function batchFailure(repos: readonly RepoMeta[], message: string): RepoMetadataResult {
  const warnings: CollectorWarning[] = repos.map((r) => ({
    collector: 'repoMetadata',
    repo: { owner: r.owner, name: r.name },
    message,
  }));
  return { dependabotConfig: [], branchProtection: [], warnings };
}

function buildVariables(repos: readonly RepoMeta[]): RepoMetadataBatchQueryVariables {
  return { ids: repos.map((repo) => repo.nodeId) };
}

function parseBatchResponse(res: RepoMetadataBatchQuery, repos: readonly RepoMeta[]): RepoMetadataResult {
  const dependabotConfig: DependabotConfigSlice[] = [];
  const branchProtection: BranchProtectionSlice[] = [];
  const warnings: CollectorWarning[] = [];
  for (let i = 0; i < repos.length; i += 1) {
    const repo = repos[i];
    if (!repo) continue;
    const node = res.nodes[i];
    if (!isRepoNode(node)) {
      warnings.push({
        collector: 'repoMetadata',
        repo: { owner: repo.owner, name: repo.name },
        message:
          node == null
            ? 'GitHub returned no repository metadata for this node ID'
            : `GitHub returned ${node.__typename} for this repository node ID`,
      });
      continue;
    }
    dependabotConfig.push(toDependabotConfigSlice(repo, node));
    branchProtection.push(toBranchProtectionSlice(repo, node));
  }
  return { dependabotConfig, branchProtection, warnings };
}

function isRepoNode(node: RepoMetadataBatchQuery['nodes'][number] | undefined): node is RepoNode {
  return node?.__typename === 'Repository';
}

function toDependabotConfigSlice(repo: RepoRef, node: RepoNode): DependabotConfigSlice {
  const text = blobText(node.yml) ?? blobText(node.yaml);
  if (text === null) {
    return { owner: repo.owner, name: repo.name, hasConfig: false, ecosystems: [], updates: [] };
  }
  const updates = parseUpdates(text);
  const ecosystems = [...new Set(updates.map((u) => u.ecosystem))].sort();
  return { owner: repo.owner, name: repo.name, hasConfig: true, ecosystems, updates };
}

function toBranchProtectionSlice(repo: RepoRef, node: RepoNode): BranchProtectionSlice {
  const ref = node.defaultBranchRef;
  if (!ref) {
    return {
      owner: repo.owner,
      name: repo.name,
      hasProtection: false,
      sources: [],
      requiredApprovingReviewCount: null,
      requiresStatusChecks: false,
    };
  }

  const sources: BranchProtectionSource[] = [];
  const reviewCounts: number[] = [];
  let requiresStatusChecks = false;

  if (ref.branchProtectionRule) {
    sources.push('classic');
    if (typeof ref.branchProtectionRule.requiredApprovingReviewCount === 'number') {
      reviewCounts.push(ref.branchProtectionRule.requiredApprovingReviewCount);
    }
    if (ref.branchProtectionRule.requiresStatusChecks) requiresStatusChecks = true;
  }

  // Match the old REST-based behavior: any active rule from a ruleset that
  // applies to this ref counts as "ruleset protection", and the presence of a
  // RequiredStatusChecksParameters rule implies status checks are required —
  // regardless of how many specific contexts are configured.
  const ruleNodes = ref.rules?.nodes ?? [];
  let hasRuleset = false;
  for (const rule of ruleNodes) {
    if (!rule) continue;
    hasRuleset = true;
    const params = rule.parameters;
    if (params?.__typename === 'PullRequestParameters') {
      if (typeof params.requiredApprovingReviewCount === 'number') {
        reviewCounts.push(params.requiredApprovingReviewCount);
      }
    } else if (params?.__typename === 'RequiredStatusChecksParameters') {
      requiresStatusChecks = true;
    }
  }
  if (hasRuleset) sources.push('ruleset');

  return {
    owner: repo.owner,
    name: repo.name,
    hasProtection: sources.length > 0,
    sources,
    requiredApprovingReviewCount: reviewCounts.length > 0 ? Math.max(...reviewCounts) : null,
    requiresStatusChecks,
  };
}

// The `object(expression: …)` field returns a `GitObject` union. Codegen models
// non-Blob arms as `Record<PropertyKey, never>`, so narrow to the Blob shape
// before reading `.text`.
function blobText(obj: RepoNode['yml']): string | null {
  if (obj === null) return null;
  if (!('text' in obj)) return null;
  return obj.text;
}

const safeYamlParse = Result.fromThrowable(
  (text: string) => Bun.YAML.parse(text),
  () => null,
);

function parseUpdates(yamlText: string): DependabotUpdateEntry[] {
  const parsed = safeYamlParse(yamlText).unwrapOr(null);
  if (!isRecord(parsed)) return [];
  const rawUpdates = parsed.updates;
  if (!Array.isArray(rawUpdates)) return [];
  const out: DependabotUpdateEntry[] = [];
  for (const raw of rawUpdates) {
    const entry = normalizeUpdate(raw);
    if (entry !== null) out.push(entry);
  }
  return out;
}

function normalizeUpdate(raw: unknown): DependabotUpdateEntry | null {
  if (!isRecord(raw)) return null;
  const ecosystem = typeof raw['package-ecosystem'] === 'string' ? raw['package-ecosystem'] : null;
  if (ecosystem === null) return null;
  return {
    ecosystem,
    interval: extractInterval(raw.schedule),
    openPullRequestsLimit: extractOpenPrLimit(raw['open-pull-requests-limit']),
    groupCount: extractGroupCount(raw.groups),
    ignoreCount: extractListCount(raw.ignore),
  };
}

function extractInterval(schedule: unknown): DependabotInterval | null {
  if (!isRecord(schedule)) return null;
  const value = schedule.interval;
  if (value === 'daily' || value === 'weekly' || value === 'monthly') return value;
  return null;
}

function extractOpenPrLimit(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value) && value >= 0) return Math.floor(value);
  return DEFAULT_OPEN_PR_LIMIT;
}

function extractGroupCount(value: unknown): number {
  if (!isRecord(value)) return 0;
  return Object.keys(value).length;
}

function extractListCount(value: unknown): number {
  if (!Array.isArray(value)) return 0;
  return value.length;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function chunk<T>(items: readonly T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}
