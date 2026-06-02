import type { GithubError } from '../github/errors.ts';
import type { GithubClient } from '../github/GithubClient.ts';
import type { RepoRef } from '../types.ts';

export type PrReadVerdict =
  | { readable: true }
  | { readable: false; reason: 'forbidden' | 'not-found' }
  | { readable: 'unknown'; error: GithubError };

/**
 * Asks one repo's REST pulls endpoint whether the token can read pull requests.
 *
 * The Dependabot PR backlog is gathered via a batched GraphQL repo query whose
 * `pullRequests` field a token missing *Pull requests: Read* (fine-grained) or
 * `repo` (classic) simply can't populate — it comes back empty, yielding a
 * confident $0 with no error to surface. The REST pulls endpoint, by contrast,
 * returns a real 403/404, so we probe it once before scanning to tell "your org
 * has no Dependabot PRs" apart from "your token can't see them".
 */
export function probePrReadAccess(client: GithubClient, repo: RepoRef): Promise<PrReadVerdict> {
  return client
    .request('GET /repos/{owner}/{repo}/pulls', { owner: repo.owner, repo: repo.name, state: 'all', per_page: 1 })
    .match(
      (): PrReadVerdict => ({ readable: true }),
      (error): PrReadVerdict => classify(error),
    );
}

function classify(error: GithubError): PrReadVerdict {
  // A fine-grained token without "Pull requests" 403s here; a classic token
  // without `repo` 404s a private repo (GitHub hides what it can't see).
  if (error.kind === 'forbidden' || error.kind === 'scope-missing') return { readable: false, reason: 'forbidden' };
  if (error.kind === 'not-found') return { readable: false, reason: 'not-found' };
  // Network/5xx/etc. — never block the scan on an inconclusive probe.
  return { readable: 'unknown', error };
}
