import { ResultAsync, errAsync } from 'neverthrow';
import { z } from 'zod';
import type { GithubError } from '../github/errors.ts';
import type { GithubClient } from '../github/GithubClient.ts';
import type { RepoMeta, RepoRef, Visibility } from '../types.ts';

// Keep repo validation permissive; dropping repos for omitted metadata would
// skew the report more than defaulting those fields.
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
    .object({
      dependabot_alerts: z.object({ status: z.enum(['enabled', 'disabled']) }).optional(),
      dependabot_security_updates: z.object({ status: z.enum(['enabled', 'disabled']) }).optional(),
    })
    .nullish(),
});
type RawRepo = z.infer<typeof repoSchema>;

export type TargetKind = 'org' | 'user';

export interface RepoListResult {
  readonly targetKind: TargetKind;
  readonly repos: RepoMeta[];
}

export function listTargetRepos(client: GithubClient, target: string): ResultAsync<RepoListResult, GithubError> {
  return client
    .paginate('GET /orgs/{org}/repos', { org: target, per_page: 100, type: 'all' }, repoSchema)
    .map((repos): RepoListResult => ({ targetKind: 'org', repos: repos.map(toRepoMeta) }))
    .orElse((err) => {
      if (err.kind === 'not-found') {
        return client
          .paginate('GET /users/{username}/repos', { username: target, per_page: 100, type: 'owner' }, repoSchema)
          .map((repos): RepoListResult => ({ targetKind: 'user', repos: repos.map(toRepoMeta) }));
      }
      return errAsync<RepoListResult, GithubError>(err);
    });
}

export function listOrgRepos(client: GithubClient, org: string): ResultAsync<RepoMeta[], GithubError> {
  return listTargetRepos(client, org).map(({ repos }) => repos);
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
  const alertsStatus = raw.security_and_analysis?.dependabot_alerts?.status;
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
    dependabotAlertsEnabled: alertsStatus === undefined ? null : alertsStatus === 'enabled',
  };
}
