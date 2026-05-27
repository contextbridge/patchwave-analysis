import { type ResultAsync, errAsync, okAsync } from 'neverthrow';
import { z } from 'zod';
import type { GithubError } from '../github/errors.ts';
import type { GithubClient } from '../github/GithubClient.ts';
import type { CveAlert, CveSeverity, CveSlice, RepoRef } from '../types.ts';

// `security_vulnerability` is null on alerts GitHub can't attribute to a
// concrete vulnerability (e.g. auto-dismissed); those carry no severity or
// package, so we skip them rather than crash.
const alertSchema = z.object({
  number: z.number(),
  created_at: z.string(),
  security_advisory: z.object({ summary: z.string() }),
  security_vulnerability: z
    .object({
      severity: z.string(),
      package: z.object({ name: z.string(), ecosystem: z.string() }),
    })
    .nullable(),
});

export function getCveAlerts(client: GithubClient, ref: RepoRef): ResultAsync<CveSlice, GithubError> {
  return client
    .paginate(
      'GET /repos/{owner}/{repo}/dependabot/alerts',
      { owner: ref.owner, repo: ref.name, state: 'open', per_page: 100 },
      alertSchema,
    )
    .map((raw): CveSlice => {
      const alerts: CveAlert[] = [];
      for (const a of raw) {
        if (a.security_vulnerability === null) continue;
        alerts.push({
          owner: ref.owner,
          name: ref.name,
          number: a.number,
          severity: normalizeSeverity(a.security_vulnerability.severity),
          createdAt: a.created_at,
          packageName: a.security_vulnerability.package.name,
          ecosystem: a.security_vulnerability.package.ecosystem,
          summary: a.security_advisory.summary,
        });
      }
      return { owner: ref.owner, name: ref.name, status: 'ok', alerts };
    })
    .orElse((err) => {
      // Token missing the security_events scope: surface to the caller so the
      // report can prompt the user to refresh auth, but don't fail the run.
      if (err.kind === 'scope-missing') {
        return okAsync<CveSlice, GithubError>({
          owner: ref.owner,
          name: ref.name,
          status: 'scope-missing',
          requiredScope: err.required,
        });
      }
      // 404 is GitHub's signal that Dependabot alerts aren't enabled on this
      // repo (or it doesn't exist for this token's scope) — semantic answer.
      if (err.kind === 'not-found') {
        return okAsync<CveSlice, GithubError>({ owner: ref.owner, name: ref.name, status: 'not-enabled' });
      }
      // GitHub also returns 403 with body "Dependabot alerts are disabled for
      // this repository." when the feature is off — treat the same as 404.
      if (err.kind === 'forbidden' && /alerts are disabled/i.test(err.message)) {
        return okAsync<CveSlice, GithubError>({ owner: ref.owner, name: ref.name, status: 'not-enabled' });
      }
      return errAsync<CveSlice, GithubError>(err);
    });
}

function normalizeSeverity(raw: string): CveSeverity {
  const v = raw.toLowerCase();
  if (v === 'critical') return 'critical';
  if (v === 'high') return 'high';
  if (v === 'medium' || v === 'moderate') return 'medium';
  return 'low';
}
