import { okAsync, ResultAsync } from "neverthrow";
import { toGithubError } from "../github/errors.ts";
import type { GithubClient } from "../github/client.ts";
import type { GithubError } from "../github/errors.ts";
import type { BranchProtectionSlice, RepoRef } from "../types.ts";

interface ProtectionResponse {
  required_pull_request_reviews?: {
    required_approving_review_count?: number;
  };
  required_status_checks?: {
    contexts?: string[];
  } | null;
}

export function getBranchProtection(
  client: GithubClient,
  ref: RepoRef,
  branch: string,
): ResultAsync<BranchProtectionSlice, GithubError> {
  return ResultAsync.fromPromise(
    client.rest.repos.getBranchProtection({ owner: ref.owner, repo: ref.name, branch }),
    toGithubError,
  )
    .map((res) => {
      const data = res.data as ProtectionResponse;
      const required = data.required_pull_request_reviews?.required_approving_review_count ?? null;
      const slice: BranchProtectionSlice = {
        ...ref,
        hasProtection: true,
        requiredApprovingReviewCount: required,
        requiresStatusChecks: (data.required_status_checks?.contexts?.length ?? 0) > 0,
      };
      return slice;
    })
    .orElse((err) => {
      if (err.kind === "not-found" || err.kind === "forbidden") {
        return okAsync<BranchProtectionSlice, GithubError>({
          ...ref,
          hasProtection: false,
          requiredApprovingReviewCount: null,
          requiresStatusChecks: false,
        });
      }
      return okAsync<BranchProtectionSlice, GithubError>({
        ...ref,
        hasProtection: false,
        requiredApprovingReviewCount: null,
        requiresStatusChecks: false,
      });
    });
}
