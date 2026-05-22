import { Result, ResultAsync, errAsync, okAsync } from 'neverthrow';
import type { GithubError } from '../github/errors.ts';
import type { GithubClient } from '../github/GithubClient.ts';
import type { DependabotConfigSlice, DependabotInterval, DependabotUpdateEntry, RepoRef } from '../types.ts';

interface ContentResponse {
  content?: string;
  encoding?: string;
}

const CONFIG_PATHS = ['.github/dependabot.yml', '.github/dependabot.yaml'];

const DEFAULT_OPEN_PR_LIMIT = 5;

type DetectedPackageManager = Exclude<DependabotConfigSlice['packageManager'], null | 'unknown'>;

// Bun 1.2 made the text-format `bun.lock` the default lockfile; older projects
// still ship the legacy binary `bun.lockb`. Check both so we don't miss a
// modern Bun project.
const LOCKFILE_CANDIDATES: ReadonlyArray<{ pm: DetectedPackageManager; path: string }> = [
  { pm: 'pnpm', path: 'pnpm-lock.yaml' },
  { pm: 'yarn', path: 'yarn.lock' },
  { pm: 'bun', path: 'bun.lock' },
  { pm: 'bun', path: 'bun.lockb' },
  { pm: 'npm', path: 'package-lock.json' },
];

const safeYamlParse = Result.fromThrowable(
  (text: string) => Bun.YAML.parse(text),
  () => null,
);

export function getDependabotConfig(
  client: GithubClient,
  ref: RepoRef,
): ResultAsync<DependabotConfigSlice, GithubError> {
  return fetchFirstAvailable(client, ref, CONFIG_PATHS).andThen((configBody) => {
    const hasConfig = configBody !== null;
    const updates = configBody === null ? [] : parseUpdates(configBody);
    const ecosystems = [...new Set(updates.map((u) => u.ecosystem))].sort();
    return resolvePackageManager(client, ref).map(
      (pm): DependabotConfigSlice => ({
        ...ref,
        hasConfig,
        ecosystems,
        updates,
        packageManager: pm,
      }),
    );
  });
}

function fetchFirstAvailable(
  client: GithubClient,
  ref: RepoRef,
  paths: readonly string[],
): ResultAsync<string | null, GithubError> {
  const [head, ...rest] = paths;
  if (head === undefined) return okAsync(null);
  return client
    .request<ContentResponse>('GET /repos/{owner}/{repo}/contents/{path}', {
      owner: ref.owner,
      repo: ref.name,
      path: head,
    })
    .map((data) => decodeContent(data))
    .orElse((err) => {
      if (err.kind === 'not-found') return fetchFirstAvailable(client, ref, rest);
      return errAsync<string | null, GithubError>(err);
    });
}

function resolvePackageManager(
  client: GithubClient,
  ref: RepoRef,
): ResultAsync<DependabotConfigSlice['packageManager'], GithubError> {
  return checkLockfile(client, ref, LOCKFILE_CANDIDATES, 0);
}

function checkLockfile(
  client: GithubClient,
  ref: RepoRef,
  candidates: ReadonlyArray<{ pm: DetectedPackageManager; path: string }>,
  index: number,
): ResultAsync<DependabotConfigSlice['packageManager'], GithubError> {
  const current = candidates[index];
  if (current === undefined) return okAsync(null);
  return client
    .request<ContentResponse>('GET /repos/{owner}/{repo}/contents/{path}', {
      owner: ref.owner,
      repo: ref.name,
      path: current.path,
    })
    .map((): DependabotConfigSlice['packageManager'] => current.pm)
    .orElse((err) => {
      if (err.kind === 'not-found') return checkLockfile(client, ref, candidates, index + 1);
      return errAsync<DependabotConfigSlice['packageManager'], GithubError>(err);
    });
}

function decodeContent(data: ContentResponse): string | null {
  if (!data.content) return null;
  if (data.encoding && data.encoding !== 'base64') return null;
  return Buffer.from(data.content, 'base64').toString('utf8');
}

function parseUpdates(yamlText: string): DependabotUpdateEntry[] {
  const parsed = safeYamlParse(yamlText).unwrapOr(null);
  if (!isRecord(parsed)) return [];
  const rawUpdates = parsed.updates;
  if (!Array.isArray(rawUpdates)) return [];
  const entries: DependabotUpdateEntry[] = [];
  for (const raw of rawUpdates) {
    const entry = normalizeUpdate(raw);
    if (entry !== null) entries.push(entry);
  }
  return entries;
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
