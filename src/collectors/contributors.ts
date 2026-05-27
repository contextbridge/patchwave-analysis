import type { ResultAsync } from 'neverthrow';
import { z } from 'zod';
import type { GithubError } from '../github/errors.ts';
import type { GithubClient } from '../github/GithubClient.ts';
import type { ContributorSlice, RepoRef } from '../types.ts';

// Treat unmatched/deleted GitHub authors as anonymous and skip them.
const commitSchema = z.object({
  author: z.object({ login: z.string(), type: z.string().optional() }).nullable().catch(null),
});

export function listActiveCommitters(
  client: GithubClient,
  ref: RepoRef,
  windowStartIso: string,
): ResultAsync<ContributorSlice, GithubError> {
  return client
    .paginate(
      'GET /repos/{owner}/{repo}/commits',
      { owner: ref.owner, repo: ref.name, since: windowStartIso, per_page: 100 },
      commitSchema,
    )
    .map((commits) => {
      const logins = new Set<string>();
      for (const { author } of commits) {
        if (!author) continue;
        if (author.type === 'Bot') continue;
        if (author.login.endsWith('[bot]')) continue;
        logins.add(author.login);
      }
      return { ...ref, activeHumanLogins: [...logins].sort() };
    });
}
