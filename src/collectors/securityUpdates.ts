import { type ResultAsync, errAsync, okAsync } from 'neverthrow';
import type { GithubError } from '../github/errors.ts';
import type { GithubClient } from '../github/GithubClient.ts';
import type { RepoMeta, SecurityUpdatesSlice } from '../types.ts';

/**
 * Reads whether Dependabot security updates are enabled, disabled, or paused for
 * inactivity on `repo`. The endpoint needs admin access; repos the token cannot
 * administer come back `unknown`.
 * https://docs.github.com/en/code-security/reference/supply-chain-security/troubleshoot-dependabot/dependabot-updates-stopped
 */
export function getSecurityUpdates(
  client: GithubClient,
  repo: RepoMeta,
): ResultAsync<SecurityUpdatesSlice, GithubError> {
  const ref = { owner: repo.owner, name: repo.name };
  return client
    .request('GET /repos/{owner}/{repo}/automated-security-fixes', { owner: repo.owner, repo: repo.name })
    .map((res): SecurityUpdatesSlice => {
      if (!res.enabled) return { ...ref, status: 'disabled' };
      return { ...ref, status: res.paused ? 'paused' : 'enabled' };
    })
    .orElse((err): ResultAsync<SecurityUpdatesSlice, GithubError> => {
      // Contrary to the docs, GitHub answers 404 when the token lacks admin on the
      // repo; a repo with security updates off returns 200 with `enabled: false`.
      if (err.kind === 'not-found' || err.kind === 'forbidden') return okAsync({ ...ref, status: 'unknown' });
      return errAsync(err);
    });
}
