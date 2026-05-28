import { ResultAsync, errAsync } from 'neverthrow';
import { z } from 'zod';
import type { GithubError } from '../github/errors.ts';
import type { GithubClient } from '../github/GithubClient.ts';
import type { RepoMeta, Visibility } from '../types.ts';

const repoSchema = z.object({
  name: z.string(),
  node_id: z.string(),
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

export interface TargetReposResult {
  readonly kind: TargetKind;
  readonly repos: RepoMeta[];
}

export function listTargetRepos(client: GithubClient, target: string): ResultAsync<TargetReposResult, GithubError> {
  return client
    .paginate('GET /orgs/{org}/repos', { org: target, per_page: 100, type: 'all' }, repoSchema)
    .map((repos): TargetReposResult => ({ kind: 'org', repos: repos.map(toRepoMeta) }))
    .orElse((err) => {
      if (err.kind === 'not-found') {
        return client
          .paginate('GET /users/{username}/repos', { username: target, per_page: 100, type: 'owner' }, repoSchema)
          .map((repos): TargetReposResult => ({ kind: 'user', repos: repos.map(toRepoMeta) }));
      }
      return errAsync<TargetReposResult, GithubError>(err);
    });
}

function toRepoMeta(raw: RawRepo): RepoMeta {
  const visibility: Visibility = raw.visibility === 'internal' ? 'internal' : raw.private ? 'private' : 'public';
  const security = raw.security_and_analysis;
  return {
    owner: raw.owner.login,
    name: raw.name,
    nodeId: raw.node_id,
    visibility,
    archived: raw.archived ?? false,
    fork: raw.fork ?? false,
    defaultBranch: raw.default_branch ?? 'main',
    primaryLanguage: raw.language ?? null,
    pushedAt: raw.pushed_at ?? null,
    dependabotSecurityUpdates: toBoolStatus(security?.dependabot_security_updates?.status),
    dependabotAlertsEnabled: toBoolStatus(security?.dependabot_alerts?.status),
  };
}

function toBoolStatus(status: 'enabled' | 'disabled' | undefined): boolean | null {
  if (status === undefined) return null;
  return status === 'enabled';
}
