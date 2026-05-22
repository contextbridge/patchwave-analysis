import { errAsync, okAsync, type ResultAsync } from "neverthrow";
import type { GithubClient } from "../github/GithubClient.ts";
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
  return client
    .paginate<RawCveAlert>("GET /repos/{owner}/{repo}/dependabot/alerts", {
      owner: ref.owner,
      repo: ref.name,
      state: "open",
      per_page: 100,
    })
    .map((raw): CveSlice => {
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
      return { status: "ok", alerts };
    })
    .orElse((err) => {
      // Token missing the security_events scope: surface to the caller so the
      // report can prompt the user to refresh auth, but don't fail the run.
      if (err.kind === "scope-missing") {
        return okAsync<CveSlice, GithubError>({
          status: "scope-missing",
          requiredScope: err.required,
        });
      }
      // 404 is GitHub's signal that Dependabot alerts aren't enabled on this
      // repo (or it doesn't exist for this token's scope) — semantic answer.
      if (err.kind === "not-found") {
        return okAsync<CveSlice, GithubError>({ status: "not-enabled" });
      }
      return errAsync<CveSlice, GithubError>(err);
    });
}

function normalizeSeverity(raw: string): CveSeverity {
  const v = raw.toLowerCase();
  if (v === "critical") return "critical";
  if (v === "high") return "high";
  if (v === "medium" || v === "moderate") return "medium";
  return "low";
}
