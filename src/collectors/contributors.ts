import type { ResultAsync } from 'neverthrow';
import type { GithubError } from '../github/errors.ts';
import type { GithubClient } from '../github/GithubClient.ts';
import type { ContributorSlice, RepoRef } from '../types.ts';

interface ListCommitsItem {
  author: { login?: string; type?: string } | null;
  commit: { author: { name: string; date: string } | null };
}

export function listActiveCommitters(
  client: GithubClient,
  ref: RepoRef,
  windowStartIso: string,
): ResultAsync<ContributorSlice, GithubError> {
  return client
    .paginate<ListCommitsItem>('GET /repos/{owner}/{repo}/commits', {
      owner: ref.owner,
      repo: ref.name,
      since: windowStartIso,
      per_page: 100,
    })
    .map((commits) => {
      const logins = new Set<string>();
      for (const c of commits) {
        const author = c.author;
        if (!author?.login) continue;
        if (author.type === 'Bot') continue;
        if (author.login.endsWith('[bot]')) continue;
        logins.add(author.login);
      }
      return { ...ref, activeHumanLogins: [...logins].sort() };
    });
}
