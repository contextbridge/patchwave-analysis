import { errAsync, ResultAsync } from "neverthrow";
import { toGithubError } from "../github/errors.ts";
import type { GithubClient } from "../github/client.ts";
import type { GithubError } from "../github/errors.ts";
import type { RepoMeta, RepoRef, Visibility } from "../types.ts";

interface RawRepo {
  name: string;
  owner: { login: string };
  private: boolean;
  visibility?: string;
  archived: boolean;
  default_branch: string;
  language: string | null;
  pushed_at: string | null;
  security_and_analysis?: {
    dependabot_security_updates?: { status: "enabled" | "disabled" };
  } | null;
}

export function listOrgRepos(
  client: GithubClient,
  org: string,
): ResultAsync<RepoMeta[], GithubError> {
  return ResultAsync.fromPromise(
    client.rest.paginate("GET /orgs/{org}/repos", {
      org,
      per_page: 100,
      type: "all",
    }) as Promise<RawRepo[]>,
    toGithubError,
  ).orElse((err) => {
    if (err.kind === "not-found") {
      return ResultAsync.fromPromise(
        client.rest.paginate("GET /users/{username}/repos", {
          username: org,
          per_page: 100,
          type: "owner",
        }) as Promise<RawRepo[]>,
        toGithubError,
      );
    }
    return errAsync<RawRepo[], GithubError>(err);
  }).map((repos) => repos.map(toRepoMeta));
}

export function getRepoLanguages(
  client: GithubClient,
  ref: RepoRef,
): ResultAsync<{ ref: RepoRef; bytes: Record<string, number> }, GithubError> {
  return ResultAsync.fromPromise(
    client.rest.repos.listLanguages({ owner: ref.owner, repo: ref.name }),
    toGithubError,
  ).map((res) => ({ ref, bytes: res.data as Record<string, number> }));
}

function toRepoMeta(raw: RawRepo): RepoMeta {
  const visibility: Visibility = raw.visibility === "internal"
    ? "internal"
    : raw.private
    ? "private"
    : "public";
  const securityUpdates = raw.security_and_analysis?.dependabot_security_updates?.status;
  return {
    owner: raw.owner.login,
    name: raw.name,
    visibility,
    archived: raw.archived,
    defaultBranch: raw.default_branch,
    primaryLanguage: raw.language,
    pushedAt: raw.pushed_at,
    dependabotSecurityUpdates:
      securityUpdates === undefined ? null : securityUpdates === "enabled",
  };
}
