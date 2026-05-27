import type { Endpoints } from '@octokit/types';
import { ResultAsync, errAsync, okAsync } from 'neverthrow';
import type { GithubError } from '../github/errors.ts';
import type { GithubClient } from '../github/GithubClient.ts';
import type { BranchProtectionSlice, BranchProtectionSource, RepoRef } from '../types.ts';

type BranchRule = Endpoints['GET /repos/{owner}/{repo}/rules/branches/{branch}']['response']['data'][number];
type PullRequestRule = Extract<BranchRule, { type: 'pull_request' }>;

interface PartialProtection {
  source: BranchProtectionSource;
  requiredApprovingReviewCount: number | null;
  requiresStatusChecks: boolean;
}

export function getBranchProtection(
  client: GithubClient,
  ref: RepoRef,
  branch: string,
): ResultAsync<BranchProtectionSlice, GithubError> {
  return ResultAsync.combine([
    getClassicProtection(client, ref, branch),
    getRulesetProtection(client, ref, branch),
  ]).map(([classic, ruleset]) => merge(ref, [classic, ruleset]));
}

function getClassicProtection(
  client: GithubClient,
  ref: RepoRef,
  branch: string,
): ResultAsync<PartialProtection | null, GithubError> {
  return client
    .request('GET /repos/{owner}/{repo}/branches/{branch}/protection', { owner: ref.owner, repo: ref.name, branch })
    .map(
      (data): PartialProtection => ({
        source: 'classic',
        requiredApprovingReviewCount: data.required_pull_request_reviews?.required_approving_review_count ?? null,
        requiresStatusChecks: (data.required_status_checks?.contexts?.length ?? 0) > 0,
      }),
    )
    .orElse((err) => {
      // 404 is the documented "no classic branch protection configured".
      if (err.kind === 'not-found') return okAsync<PartialProtection | null, GithubError>(null);
      return errAsync<PartialProtection | null, GithubError>(err);
    });
}

function getRulesetProtection(
  client: GithubClient,
  ref: RepoRef,
  branch: string,
): ResultAsync<PartialProtection | null, GithubError> {
  // The /rules/branches/{branch} endpoint returns the effective rules applied
  // to a branch from any active ruleset (repo-level or inherited). It does NOT
  // include classic branch protection — that's still a separate endpoint.
  return client
    .request('GET /repos/{owner}/{repo}/rules/branches/{branch}', { owner: ref.owner, repo: ref.name, branch })
    .map((rules): PartialProtection | null => {
      if (rules.length === 0) return null;
      const prRule = rules.find((r): r is PullRequestRule => r.type === 'pull_request');
      const statusRule = rules.find((r) => r.type === 'required_status_checks');
      const reviewCount = prRule?.parameters?.required_approving_review_count;
      return {
        source: 'ruleset',
        requiredApprovingReviewCount: typeof reviewCount === 'number' ? reviewCount : null,
        requiresStatusChecks: statusRule !== undefined,
      };
    })
    .orElse((err) => {
      if (err.kind === 'not-found') return okAsync<PartialProtection | null, GithubError>(null);
      return errAsync<PartialProtection | null, GithubError>(err);
    });
}

function merge(ref: RepoRef, parts: ReadonlyArray<PartialProtection | null>): BranchProtectionSlice {
  const active = parts.filter((p): p is PartialProtection => p !== null);
  const reviewCounts = active
    .map((p) => p.requiredApprovingReviewCount)
    .filter((n): n is number => typeof n === 'number');
  return {
    ...ref,
    hasProtection: active.length > 0,
    sources: active.map((p) => p.source),
    // When multiple sources require reviews, the strictest one wins.
    requiredApprovingReviewCount: reviewCounts.length > 0 ? Math.max(...reviewCounts) : null,
    requiresStatusChecks: active.some((p) => p.requiresStatusChecks),
  };
}
