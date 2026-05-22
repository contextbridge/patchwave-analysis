import { okAsync, ResultAsync, errAsync } from "neverthrow";
import type { GithubClient } from "../github/GithubClient.ts";
import type { GithubError } from "../github/errors.ts";
import type { DependabotConfigSlice, RepoRef } from "../types.ts";

interface ContentResponse {
  content?: string;
  encoding?: string;
}

const CONFIG_PATHS = [".github/dependabot.yml", ".github/dependabot.yaml"];
const LOCKFILES: Record<DependabotConfigSlice["packageManager"] & string, string> = {
  pnpm: "pnpm-lock.yaml",
  yarn: "yarn.lock",
  bun: "bun.lockb",
  npm: "package-lock.json",
  unknown: "",
};

export function getDependabotConfig(
  client: GithubClient,
  ref: RepoRef,
): ResultAsync<DependabotConfigSlice, GithubError> {
  return fetchFirstAvailable(client, ref, CONFIG_PATHS).andThen((configBody) => {
    const hasConfig = configBody !== null;
    const ecosystems = configBody === null ? [] : parseEcosystems(configBody);
    return resolvePackageManager(client, ref).map(
      (pm): DependabotConfigSlice => ({
        ...ref,
        hasConfig,
        ecosystems,
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
    .request<ContentResponse>("GET /repos/{owner}/{repo}/contents/{path}", {
      owner: ref.owner,
      repo: ref.name,
      path: head,
    })
    .map((data) => decodeContent(data))
    .orElse((err) => {
      if (err.kind === "not-found") return fetchFirstAvailable(client, ref, rest);
      return errAsync<string | null, GithubError>(err);
    });
}

function resolvePackageManager(
  client: GithubClient,
  ref: RepoRef,
): ResultAsync<DependabotConfigSlice["packageManager"], GithubError> {
  const candidates: Array<{ pm: DependabotConfigSlice["packageManager"] & string; path: string }> = [
    { pm: "pnpm", path: LOCKFILES.pnpm },
    { pm: "yarn", path: LOCKFILES.yarn },
    { pm: "bun", path: LOCKFILES.bun },
    { pm: "npm", path: LOCKFILES.npm },
  ];
  return checkLockfile(client, ref, candidates, 0);
}

function checkLockfile(
  client: GithubClient,
  ref: RepoRef,
  candidates: ReadonlyArray<{ pm: DependabotConfigSlice["packageManager"] & string; path: string }>,
  index: number,
): ResultAsync<DependabotConfigSlice["packageManager"], GithubError> {
  const current = candidates[index];
  if (current === undefined) return okAsync(null);
  return client
    .request<ContentResponse>("GET /repos/{owner}/{repo}/contents/{path}", {
      owner: ref.owner,
      repo: ref.name,
      path: current.path,
    })
    .map(() => current.pm as DependabotConfigSlice["packageManager"])
    .orElse((err) => {
      if (err.kind === "not-found") return checkLockfile(client, ref, candidates, index + 1);
      return errAsync<DependabotConfigSlice["packageManager"], GithubError>(err);
    });
}

function decodeContent(data: ContentResponse): string | null {
  if (!data.content) return null;
  if (data.encoding && data.encoding !== "base64") return null;
  return Buffer.from(data.content, "base64").toString("utf8");
}

function parseEcosystems(yamlText: string): string[] {
  const matches = yamlText.matchAll(/package-ecosystem:\s*["']?([\w-]+)["']?/g);
  const ecosystems = new Set<string>();
  for (const match of matches) {
    if (match[1]) ecosystems.add(match[1]);
  }
  return [...ecosystems].sort();
}
