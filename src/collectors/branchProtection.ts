import { okAsync, ResultAsync, errAsync } from "neverthrow";
import type { GithubClient } from "../github/GithubClient.ts";
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
  return client
    .request<ProtectionResponse>("GET /repos/{owner}/{repo}/branches/{branch}/protection", {
      owner: ref.owner,
      repo: ref.name,
      branch,
    })
    .map((data): BranchProtectionSlice => {
      const required = data.required_pull_request_reviews?.required_approving_review_count ?? null;
      return {
        ...ref,
        hasProtection: true,
        requiredApprovingReviewCount: required,
        requiresStatusChecks: (data.required_status_checks?.contexts?.length ?? 0) > 0,
      };
    })
    .orElse((err) => {
      // 404 is the documented signal that no protection rule exists.
      if (err.kind === "not-found") {
        return okAsync<BranchProtectionSlice, GithubError>({
          ...ref,
          hasProtection: false,
          requiredApprovingReviewCount: null,
          requiresStatusChecks: false,
        });
      }
      return errAsync<BranchProtectionSlice, GithubError>(err);
    });
}
