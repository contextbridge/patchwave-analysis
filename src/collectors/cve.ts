import { type ResultAsync, errAsync, okAsync } from 'neverthrow';
import { z } from 'zod';
import type { GithubError } from '../github/errors.ts';
import type { GithubClient } from '../github/GithubClient.ts';
import type { CveAlert, CveSeverity, CveSlice, RepoMeta, RepoRef } from '../types.ts';

// `security_vulnerability` is null on alerts GitHub can't attribute to a
// concrete vulnerability (e.g. auto-dismissed); those carry no severity or
// package, so we skip them rather than crash.
export const alertSchema = z.object({
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

const orgAlertSchema = alertSchema.extend({
  repository: z.object({
    name: z.string(),
    owner: z.object({ login: z.string() }),
  }),
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
        alerts.push(toCveAlert(ref, a));
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

export function getOrgCveAlerts(
  client: GithubClient,
  org: string,
  repos: readonly RepoMeta[],
): ResultAsync<CveSlice[], GithubError> {
  return client
    .paginate('GET /orgs/{org}/dependabot/alerts', { org, state: 'open', per_page: 100 }, orgAlertSchema)
    .map((raw): CveSlice[] => {
      const byRepo = new Map<string, CveAlert[]>();
      const included = new Set(repos.map((repo) => repoKey(repo)));
      for (const a of raw) {
        const ref = { owner: a.repository.owner.login, name: a.repository.name };
        const key = repoKey(ref);
        if (!included.has(key) || a.security_vulnerability === null) continue;
        const alerts = byRepo.get(key) ?? [];
        alerts.push(toCveAlert(ref, a));
        byRepo.set(key, alerts);
      }
      return repos.map((repo): CveSlice => {
        if (repo.dependabotAlertsEnabled === false)
          return { owner: repo.owner, name: repo.name, status: 'not-enabled' };
        return { owner: repo.owner, name: repo.name, status: 'ok', alerts: byRepo.get(repoKey(repo)) ?? [] };
      });
    })
    .orElse((err) => {
      if (err.kind === 'scope-missing') {
        return okAsync<CveSlice[], GithubError>(
          repos.map((repo) => ({
            owner: repo.owner,
            name: repo.name,
            status: 'scope-missing',
            requiredScope: err.required,
          })),
        );
      }
      return errAsync<CveSlice[], GithubError>(err);
    });
}

function toCveAlert(ref: RepoRef, raw: z.infer<typeof alertSchema>): CveAlert {
  if (raw.security_vulnerability === null) {
    return {
      owner: ref.owner,
      name: ref.name,
      number: raw.number,
      severity: 'low',
      createdAt: raw.created_at,
      packageName: '',
      ecosystem: '',
      summary: raw.security_advisory.summary,
    };
  }
  return {
    owner: ref.owner,
    name: ref.name,
    number: raw.number,
    severity: normalizeSeverity(raw.security_vulnerability.severity),
    createdAt: raw.created_at,
    packageName: raw.security_vulnerability.package.name,
    ecosystem: raw.security_vulnerability.package.ecosystem,
    summary: raw.security_advisory.summary,
  };
}

function repoKey(ref: RepoRef): string {
  return `${ref.owner}/${ref.name}`;
}

function normalizeSeverity(raw: string): CveSeverity {
  const v = raw.toLowerCase();
  if (v === 'critical') return 'critical';
  if (v === 'high') return 'high';
  if (v === 'medium' || v === 'moderate') return 'medium';
  return 'low';
}
