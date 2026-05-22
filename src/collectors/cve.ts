import { okAsync, ResultAsync } from "neverthrow";
import { toGithubError } from "../github/errors.ts";
import type { GithubClient } from "../github/client.ts";
import type { GithubError } from "../github/errors.ts";
import type { CveAlert, CveSeverity, CveSlice, RepoRef } from "../types.ts";

interface RawCveAlert {
  number: number;
  state: string;
  created_at: string;
  security_advisory: { summary: string };
  security_vulnerability: {
    severity: string;
    package: { name: string; ecosystem: string };
  };
}

export function getCveAlerts(
  client: GithubClient,
  ref: RepoRef,
): ResultAsync<CveSlice, GithubError> {
  return ResultAsync.fromPromise(
    client.rest.paginate("GET /repos/{owner}/{repo}/dependabot/alerts", {
      owner: ref.owner,
      repo: ref.name,
      state: "open",
      per_page: 100,
    }) as Promise<RawCveAlert[]>,
    toGithubError,
  )
    .map((raw) => {
      const alerts: CveAlert[] = raw.map((a) => ({
        owner: ref.owner,
        name: ref.name,
        number: a.number,
        severity: normalizeSeverity(a.security_vulnerability.severity),
        createdAt: a.created_at,
        packageName: a.security_vulnerability.package.name,
        ecosystem: a.security_vulnerability.package.ecosystem,
        summary: a.security_advisory.summary,
      }));
      const slice: CveSlice = { status: "ok", alerts };
      return slice;
    })
    .orElse((err) => {
      if (err.kind === "scope-missing") {
        return okAsync<CveSlice, GithubError>({
          status: "scope-missing",
          requiredScope: "security_events",
        });
      }
      if (err.kind === "forbidden" || err.kind === "not-found") {
        return okAsync<CveSlice, GithubError>({ status: "not-enabled" });
      }
      return okAsync<CveSlice, GithubError>({ status: "not-enabled" });
    });
}

function normalizeSeverity(raw: string): CveSeverity {
  const v = raw.toLowerCase();
  if (v === "critical") return "critical";
  if (v === "high") return "high";
  if (v === "medium" || v === "moderate") return "medium";
  return "low";
}
