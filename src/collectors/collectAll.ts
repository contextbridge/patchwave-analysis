import type { ResultAsync } from 'neverthrow';
import pMap from 'p-map';
import type { Context } from '../context/index.ts';
import { type GithubError, formatGithubError } from '../github/errors.ts';
import type { GithubClient } from '../github/GithubClient.ts';
import type { Instant } from '../time.ts';
import {
  type CollectedData,
  type CollectorWarning,
  type CveSlice,
  type DependabotPr,
  type RepoMeta,
  type RepositorySelection,
  activeReposInSelection,
  repoKey,
} from '../types.ts';
import { getCveAlerts, getOrgCveAlerts } from './cve.ts';
import { listDependabotPrs } from './dependabotPrs.ts';
import type { TargetKind } from './repos.ts';

interface CollectInput {
  readonly repos: RepoMeta[];
  readonly target: string;
  readonly targetKind: TargetKind;
  readonly windowDays: number;
  readonly windowStart: Instant;
  readonly now: Instant;
  readonly repositorySelection: RepositorySelection;
}

// Crawls every data slice for the target, tolerating per-slice failures: a failed
// collector records a `CollectorWarning` and degrades to empty rather than aborting
// the whole run (see error-handling-neverthrow.md's partial-failure boundary).
export async function collectAll(ctx: Context, input: CollectInput): Promise<CollectedData> {
  const { repos, target, targetKind, windowDays, windowStart, now, repositorySelection } = input;
  const { githubClient } = ctx;
  const warnings: CollectorWarning[] = [];

  const selectedRepos = activeReposInSelection(repos, repositorySelection);
  const selectedKeys = new Set(selectedRepos.map(repoKey));

  const cvePromise =
    selectedRepos.length > 0
      ? collectCve(githubClient, target, targetKind, selectedRepos, warnings)
      : Promise.resolve([] as CveSlice[]);

  const prsPromise =
    selectedRepos.length > 0
      ? collectFallible(
          listDependabotPrs(ctx, target, targetKind, windowStart.toString(), now.toString()),
          [] as DependabotPr[],
          warnings,
          'dependabotPrs',
        ).then((prs) => prs.filter((pr) => selectedKeys.has(repoKey(pr))))
      : Promise.resolve([] as DependabotPr[]);

  const [cve, dependabotPrs] = await Promise.all([cvePromise, prsPromise]);

  return {
    ctx: { org: target, windowDays, windowStart, now, repositorySelection },
    repos,
    dependabotPrs,
    cve,
    errors: warnings,
  };
}

async function collectCve(
  client: GithubClient,
  target: string,
  targetKind: TargetKind,
  repos: readonly RepoMeta[],
  warnings: CollectorWarning[],
): Promise<CveSlice[]> {
  const perRepo = (): Promise<CveSlice[]> =>
    crawlPerRepo(repos, (r) => getCveAlerts(client, { owner: r.owner, name: r.name }), warnings, 'cve');

  if (targetKind === 'user') return perRepo();
  // Try the org-level endpoint first (one call instead of N). On anything other
  // than scope-missing, fall back to per-repo so each repo gets a real status
  // determination instead of an empty list.
  const orgResult = await getOrgCveAlerts(client, target, repos);
  if (orgResult.isOk()) return orgResult.value;
  // A 404/403 means we don't run this org; the per-repo fallback marks each repo
  // `no-access` and the report surfaces that. Only warn on genuine anomalies.
  if (orgResult.error.kind !== 'not-found' && orgResult.error.kind !== 'forbidden') {
    warnings.push({ collector: 'cve', message: formatGithubError(orgResult.error) });
  }
  return perRepo();
}

async function crawlPerRepo<T>(
  repos: readonly RepoMeta[],
  fn: (repo: RepoMeta) => ResultAsync<T, GithubError>,
  warnings: CollectorWarning[],
  collector: string,
): Promise<T[]> {
  const results = await pMap(repos, async (repo) => ({ repo, result: await fn(repo) }), { concurrency: 8 });
  const ok: T[] = [];
  for (const { repo, result } of results) {
    if (result.isOk()) {
      ok.push(result.value);
    } else {
      warnings.push({
        collector,
        repo: { owner: repo.owner, name: repo.name },
        message: formatGithubError(result.error),
      });
    }
  }
  return ok;
}

function collectFallible<T>(
  ra: ResultAsync<T, GithubError>,
  fallback: T,
  warnings: CollectorWarning[],
  collector: string,
): Promise<T> {
  return ra.match(
    (value) => value,
    (error) => {
      warnings.push({ collector, message: formatGithubError(error) });
      return fallback;
    },
  );
}
