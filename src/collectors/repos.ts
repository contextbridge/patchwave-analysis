import { ResultAsync, errAsync } from 'neverthrow';
import { z } from 'zod';
import type { GithubError } from '../github/errors.ts';
import type { GithubClient } from '../github/GithubClient.ts';
import type { RepoMeta, RepoRef, Visibility } from '../types.ts';

// The org-repos and user-repos endpoints return slightly different repository
// shapes; validating both against one schema yields a single item type and
// keeps the `orElse` fallback well-typed. Only `name` + `owner` are required —
// everything else is optional with a default, so a repo is never dropped for a
// field GitHub happens to omit (under-counting repos would skew the report).
const repoSchema = z.object({
  name: z.string(),
  owner: z.object({ login: z.string() }),
  private: z.boolean().optional(),
  visibility: z.string().optional(),
  archived: z.boolean().optional(),
  fork: z.boolean().optional(),
  default_branch: z.string().optional(),
  language: z.string().nullish(),
  pushed_at: z.string().nullish(),
  security_and_analysis: z
    .object({ dependabot_security_updates: z.object({ status: z.enum(['enabled', 'disabled']) }).optional() })
    .nullish(),
});
type RawRepo = z.infer<typeof repoSchema>;

export function listOrgRepos(client: GithubClient, org: string): ResultAsync<RepoMeta[], GithubError> {
  return client
    .paginate('GET /orgs/{org}/repos', { org, per_page: 100, type: 'all' }, repoSchema)
    .orElse((err) => {
      if (err.kind === 'not-found') {
        return client.paginate(
          'GET /users/{username}/repos',
          { username: org, per_page: 100, type: 'owner' },
          repoSchema,
        );
      }
      return errAsync<RawRepo[], GithubError>(err);
    })
    .map((repos) => repos.map(toRepoMeta));
}

export function getRepoLanguages(
  client: GithubClient,
  ref: RepoRef,
): ResultAsync<{ ref: RepoRef; bytes: Record<string, number> }, GithubError> {
  return client
    .request('GET /repos/{owner}/{repo}/languages', { owner: ref.owner, repo: ref.name })
    .map((bytes) => ({ ref, bytes }));
}

function toRepoMeta(raw: RawRepo): RepoMeta {
  const visibility: Visibility = raw.visibility === 'internal' ? 'internal' : raw.private ? 'private' : 'public';
  const securityUpdates = raw.security_and_analysis?.dependabot_security_updates?.status;
  return {
    owner: raw.owner.login,
    name: raw.name,
    visibility,
    archived: raw.archived ?? false,
    fork: raw.fork ?? false,
    defaultBranch: raw.default_branch ?? 'main',
    primaryLanguage: raw.language ?? null,
    pushedAt: raw.pushed_at ?? null,
    dependabotSecurityUpdates: securityUpdates === undefined ? null : securityUpdates === 'enabled',
  };
}
