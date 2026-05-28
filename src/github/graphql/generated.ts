/** Internal type. DO NOT USE DIRECTLY. */
type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
/** Internal type. DO NOT USE DIRECTLY. */
export type Incremental<T> = T | { [P in keyof T]?: P extends ' $fragmentName' | '__typename' ? T[P] : never };
import type { TypedDocumentNode as DocumentNode } from '@graphql-typed-document-node/core';
/** The possible states for a check suite or run conclusion. */
export type CheckConclusionState =
  /** The check suite or run requires action. */
  | 'ACTION_REQUIRED'
  /** The check suite or run has been cancelled. */
  | 'CANCELLED'
  /** The check suite or run has failed. */
  | 'FAILURE'
  /** The check suite or run was neutral. */
  | 'NEUTRAL'
  /** The check suite or run was skipped. */
  | 'SKIPPED'
  /** The check suite or run was marked stale by GitHub. Only GitHub can use this conclusion. */
  | 'STALE'
  /** The check suite or run has failed at startup. */
  | 'STARTUP_FAILURE'
  /** The check suite or run has succeeded. */
  | 'SUCCESS'
  /** The check suite or run has timed out. */
  | 'TIMED_OUT';

/** The possible states of a pull request. */
export type PullRequestState =
  /** A pull request that has been closed without being merged. */
  | 'CLOSED'
  /** A pull request that has been closed by being merged. */
  | 'MERGED'
  /** A pull request that is still open. */
  | 'OPEN';

/** The rule types supported in rulesets */
export type RepositoryRuleType =
  /** Authorization */
  | 'AUTHORIZATION'
  /** Branch name pattern */
  | 'BRANCH_NAME_PATTERN'
  /**
   * Choose which tools must provide code scanning results before the reference is
   * updated. When configured, code scanning must be enabled and have results for
   * both the commit and the reference being updated.
   */
  | 'CODE_SCANNING'
  /** Committer email pattern */
  | 'COMMITTER_EMAIL_PATTERN'
  /** Commit author email pattern */
  | 'COMMIT_AUTHOR_EMAIL_PATTERN'
  /** Commit message pattern */
  | 'COMMIT_MESSAGE_PATTERN'
  /** Only allow users with bypass permission to create matching refs. */
  | 'CREATION'
  /** Only allow users with bypass permissions to delete matching refs. */
  | 'DELETION'
  /** Prevent commits that include files with specified file extensions from being pushed to the commit graph. */
  | 'FILE_EXTENSION_RESTRICTION'
  /** Prevent commits that include changes in specified file paths from being pushed to the commit graph. */
  | 'FILE_PATH_RESTRICTION'
  /** Branch is read-only. Users cannot push to the branch. */
  | 'LOCK_BRANCH'
  /** Prevent commits that include file paths that exceed a specified character limit from being pushed to the commit graph. */
  | 'MAX_FILE_PATH_LENGTH'
  /** Prevent commits that exceed a specified file size limit from being pushed to the commit graph. */
  | 'MAX_FILE_SIZE'
  /** Max ref updates */
  | 'MAX_REF_UPDATES'
  /** Merges must be performed via a merge queue. */
  | 'MERGE_QUEUE'
  /** Merge queue locked ref */
  | 'MERGE_QUEUE_LOCKED_REF'
  /** Prevent users with push access from force pushing to refs. */
  | 'NON_FAST_FORWARD'
  /** Require all commits be made to a non-target branch and submitted via a pull request before they can be merged. */
  | 'PULL_REQUEST'
  /** Choose which environments must be successfully deployed to before refs can be pushed into a ref that matches this rule. */
  | 'REQUIRED_DEPLOYMENTS'
  /** Prevent merge commits from being pushed to matching refs. */
  | 'REQUIRED_LINEAR_HISTORY'
  /**
   * When enabled, all conversations on code must be resolved before a pull request
   * can be merged into a branch that matches this rule.
   */
  | 'REQUIRED_REVIEW_THREAD_RESOLUTION'
  /** Commits pushed to matching refs must have verified signatures. */
  | 'REQUIRED_SIGNATURES'
  /**
   * Choose which status checks must pass before the ref is updated. When enabled,
   * commits must first be pushed to another ref where the checks pass.
   */
  | 'REQUIRED_STATUS_CHECKS'
  /**
   * Require all commits be made to a non-target branch and submitted via a pull
   * request and required workflow checks to pass before they can be merged.
   */
  | 'REQUIRED_WORKFLOW_STATUS_CHECKS'
  /** Secret scanning */
  | 'SECRET_SCANNING'
  /** Tag */
  | 'TAG'
  /** Tag name pattern */
  | 'TAG_NAME_PATTERN'
  /** Only allow users with bypass permission to update matching refs. */
  | 'UPDATE'
  /** Require all changes made to a targeted branch to pass the specified workflows before they can be merged. */
  | 'WORKFLOWS'
  /** Workflow files cannot be modified. */
  | 'WORKFLOW_UPDATES';

/** The possible commit status states. */
export type StatusState =
  /** Status is errored. */
  | 'ERROR'
  /** Status is expected. */
  | 'EXPECTED'
  /** Status is failing. */
  | 'FAILURE'
  /** Status is pending. */
  | 'PENDING'
  /** Status is successful. */
  | 'SUCCESS';

export type DependabotPrsQueryVariables = Exact<{
  searchQuery: string;
  cursor?: string | null | undefined;
}>;


export type DependabotPrsQuery = { search: { pageInfo: { hasNextPage: boolean, endCursor: string | null }, nodes: Array<
      | { number: number, title: string, state: PullRequestState, createdAt: string, closedAt: string | null, mergedAt: string | null, url: string, baseRefName: string, headRefName: string, mergedBy:
          | { __typename: 'Bot', login: string }
          | { __typename: 'EnterpriseUserAccount', login: string }
          | { __typename: 'Mannequin', login: string }
          | { __typename: 'Organization', login: string }
          | { __typename: 'User', login: string }
         | null, autoMergeRequest: { enabledAt: string | null } | null, repository: { name: string, owner:
            | { login: string }
            | { login: string }
           }, reviews: { nodes: Array<{ author:
              | { __typename: 'Bot', login: string }
              | { __typename: 'EnterpriseUserAccount', login: string }
              | { __typename: 'Mannequin', login: string }
              | { __typename: 'Organization', login: string }
              | { __typename: 'User', login: string }
             | null } | null> | null } | null, comments: { nodes: Array<{ author:
              | { __typename: 'Bot', login: string }
              | { __typename: 'EnterpriseUserAccount', login: string }
              | { __typename: 'Mannequin', login: string }
              | { __typename: 'Organization', login: string }
              | { __typename: 'User', login: string }
             | null } | null> | null }, commits: { nodes: Array<{ commit: { statusCheckRollup: { contexts: { nodes: Array<
                    | { __typename: 'CheckRun', name: string, conclusion: CheckConclusionState | null }
                    | { __typename: 'StatusContext', context: string, state: StatusState }
                   | null> | null } } | null } } | null> | null } }
      | Record<PropertyKey, never>
     | null> | null } };

export type RepoMetadataBatchQueryVariables = Exact<{
  ids: Array<string | number> | string | number;
}>;


export type RepoMetadataBatchQuery = { nodes: Array<
    | { __typename: 'AddedToMergeQueueEvent' }
    | { __typename: 'AddedToProjectEvent' }
    | { __typename: 'App' }
    | { __typename: 'AssignedEvent' }
    | { __typename: 'AutoMergeDisabledEvent' }
    | { __typename: 'AutoMergeEnabledEvent' }
    | { __typename: 'AutoRebaseEnabledEvent' }
    | { __typename: 'AutoSquashEnabledEvent' }
    | { __typename: 'AutomaticBaseChangeFailedEvent' }
    | { __typename: 'AutomaticBaseChangeSucceededEvent' }
    | { __typename: 'BaseRefChangedEvent' }
    | { __typename: 'BaseRefDeletedEvent' }
    | { __typename: 'BaseRefForcePushedEvent' }
    | { __typename: 'Blob' }
    | { __typename: 'Bot' }
    | { __typename: 'BranchProtectionRule' }
    | { __typename: 'BypassForcePushAllowance' }
    | { __typename: 'BypassPullRequestAllowance' }
    | { __typename: 'CWE' }
    | { __typename: 'CheckRun' }
    | { __typename: 'CheckSuite' }
    | { __typename: 'ClosedEvent' }
    | { __typename: 'CodeOfConduct' }
    | { __typename: 'CommentDeletedEvent' }
    | { __typename: 'Commit' }
    | { __typename: 'CommitComment' }
    | { __typename: 'CommitCommentThread' }
    | { __typename: 'Comparison' }
    | { __typename: 'ConnectedEvent' }
    | { __typename: 'ConvertToDraftEvent' }
    | { __typename: 'ConvertedNoteToIssueEvent' }
    | { __typename: 'ConvertedToDiscussionEvent' }
    | { __typename: 'CrossReferencedEvent' }
    | { __typename: 'DemilestonedEvent' }
    | { __typename: 'DependencyGraphManifest' }
    | { __typename: 'DeployKey' }
    | { __typename: 'DeployedEvent' }
    | { __typename: 'Deployment' }
    | { __typename: 'DeploymentEnvironmentChangedEvent' }
    | { __typename: 'DeploymentReview' }
    | { __typename: 'DeploymentStatus' }
    | { __typename: 'DisconnectedEvent' }
    | { __typename: 'Discussion' }
    | { __typename: 'DiscussionCategory' }
    | { __typename: 'DiscussionComment' }
    | { __typename: 'DiscussionPoll' }
    | { __typename: 'DiscussionPollOption' }
    | { __typename: 'DraftIssue' }
    | { __typename: 'Enterprise' }
    | { __typename: 'EnterpriseAdministratorInvitation' }
    | { __typename: 'EnterpriseIdentityProvider' }
    | { __typename: 'EnterpriseMemberInvitation' }
    | { __typename: 'EnterpriseRepositoryInfo' }
    | { __typename: 'EnterpriseServerInstallation' }
    | { __typename: 'EnterpriseServerUserAccount' }
    | { __typename: 'EnterpriseServerUserAccountEmail' }
    | { __typename: 'EnterpriseServerUserAccountsUpload' }
    | { __typename: 'EnterpriseUserAccount' }
    | { __typename: 'Environment' }
    | { __typename: 'ExternalIdentity' }
    | { __typename: 'Gist' }
    | { __typename: 'GistComment' }
    | { __typename: 'HeadRefDeletedEvent' }
    | { __typename: 'HeadRefForcePushedEvent' }
    | { __typename: 'HeadRefRestoredEvent' }
    | { __typename: 'IpAllowListEntry' }
    | { __typename: 'Issue' }
    | { __typename: 'IssueComment' }
    | { __typename: 'Label' }
    | { __typename: 'LabeledEvent' }
    | { __typename: 'Language' }
    | { __typename: 'License' }
    | { __typename: 'LinkedBranch' }
    | { __typename: 'LockedEvent' }
    | { __typename: 'Mannequin' }
    | { __typename: 'MarkedAsDuplicateEvent' }
    | { __typename: 'MarketplaceCategory' }
    | { __typename: 'MarketplaceListing' }
    | { __typename: 'MemberFeatureRequestNotification' }
    | { __typename: 'MembersCanDeleteReposClearAuditEntry' }
    | { __typename: 'MembersCanDeleteReposDisableAuditEntry' }
    | { __typename: 'MembersCanDeleteReposEnableAuditEntry' }
    | { __typename: 'MentionedEvent' }
    | { __typename: 'MergeQueue' }
    | { __typename: 'MergeQueueEntry' }
    | { __typename: 'MergedEvent' }
    | { __typename: 'MigrationSource' }
    | { __typename: 'Milestone' }
    | { __typename: 'MilestonedEvent' }
    | { __typename: 'MovedColumnsInProjectEvent' }
    | { __typename: 'OIDCProvider' }
    | { __typename: 'OauthApplicationCreateAuditEntry' }
    | { __typename: 'OrgAddBillingManagerAuditEntry' }
    | { __typename: 'OrgAddMemberAuditEntry' }
    | { __typename: 'OrgBlockUserAuditEntry' }
    | { __typename: 'OrgConfigDisableCollaboratorsOnlyAuditEntry' }
    | { __typename: 'OrgConfigEnableCollaboratorsOnlyAuditEntry' }
    | { __typename: 'OrgCreateAuditEntry' }
    | { __typename: 'OrgDisableOauthAppRestrictionsAuditEntry' }
    | { __typename: 'OrgDisableSamlAuditEntry' }
    | { __typename: 'OrgDisableTwoFactorRequirementAuditEntry' }
    | { __typename: 'OrgEnableOauthAppRestrictionsAuditEntry' }
    | { __typename: 'OrgEnableSamlAuditEntry' }
    | { __typename: 'OrgEnableTwoFactorRequirementAuditEntry' }
    | { __typename: 'OrgInviteMemberAuditEntry' }
    | { __typename: 'OrgInviteToBusinessAuditEntry' }
    | { __typename: 'OrgOauthAppAccessApprovedAuditEntry' }
    | { __typename: 'OrgOauthAppAccessBlockedAuditEntry' }
    | { __typename: 'OrgOauthAppAccessDeniedAuditEntry' }
    | { __typename: 'OrgOauthAppAccessRequestedAuditEntry' }
    | { __typename: 'OrgOauthAppAccessUnblockedAuditEntry' }
    | { __typename: 'OrgRemoveBillingManagerAuditEntry' }
    | { __typename: 'OrgRemoveMemberAuditEntry' }
    | { __typename: 'OrgRemoveOutsideCollaboratorAuditEntry' }
    | { __typename: 'OrgRestoreMemberAuditEntry' }
    | { __typename: 'OrgUnblockUserAuditEntry' }
    | { __typename: 'OrgUpdateDefaultRepositoryPermissionAuditEntry' }
    | { __typename: 'OrgUpdateMemberAuditEntry' }
    | { __typename: 'OrgUpdateMemberRepositoryCreationPermissionAuditEntry' }
    | { __typename: 'OrgUpdateMemberRepositoryInvitationPermissionAuditEntry' }
    | { __typename: 'Organization' }
    | { __typename: 'OrganizationIdentityProvider' }
    | { __typename: 'OrganizationInvitation' }
    | { __typename: 'OrganizationMigration' }
    | { __typename: 'Package' }
    | { __typename: 'PackageFile' }
    | { __typename: 'PackageTag' }
    | { __typename: 'PackageVersion' }
    | { __typename: 'ParentIssueAddedEvent' }
    | { __typename: 'ParentIssueRemovedEvent' }
    | { __typename: 'PinnedDiscussion' }
    | { __typename: 'PinnedEnvironment' }
    | { __typename: 'PinnedEvent' }
    | { __typename: 'PinnedIssue' }
    | { __typename: 'PrivateRepositoryForkingDisableAuditEntry' }
    | { __typename: 'PrivateRepositoryForkingEnableAuditEntry' }
    | { __typename: 'Project' }
    | { __typename: 'ProjectCard' }
    | { __typename: 'ProjectColumn' }
    | { __typename: 'ProjectV2' }
    | { __typename: 'ProjectV2Field' }
    | { __typename: 'ProjectV2Item' }
    | { __typename: 'ProjectV2ItemFieldDateValue' }
    | { __typename: 'ProjectV2ItemFieldIterationValue' }
    | { __typename: 'ProjectV2ItemFieldNumberValue' }
    | { __typename: 'ProjectV2ItemFieldSingleSelectValue' }
    | { __typename: 'ProjectV2ItemFieldTextValue' }
    | { __typename: 'ProjectV2IterationField' }
    | { __typename: 'ProjectV2SingleSelectField' }
    | { __typename: 'ProjectV2StatusUpdate' }
    | { __typename: 'ProjectV2View' }
    | { __typename: 'ProjectV2Workflow' }
    | { __typename: 'PublicKey' }
    | { __typename: 'PullRequest' }
    | { __typename: 'PullRequestCommit' }
    | { __typename: 'PullRequestCommitCommentThread' }
    | { __typename: 'PullRequestReview' }
    | { __typename: 'PullRequestReviewComment' }
    | { __typename: 'PullRequestReviewThread' }
    | { __typename: 'PullRequestThread' }
    | { __typename: 'Push' }
    | { __typename: 'PushAllowance' }
    | { __typename: 'Query' }
    | { __typename: 'Reaction' }
    | { __typename: 'ReadyForReviewEvent' }
    | { __typename: 'Ref' }
    | { __typename: 'ReferencedEvent' }
    | { __typename: 'Release' }
    | { __typename: 'ReleaseAsset' }
    | { __typename: 'RemovedFromMergeQueueEvent' }
    | { __typename: 'RemovedFromProjectEvent' }
    | { __typename: 'RenamedTitleEvent' }
    | { __typename: 'ReopenedEvent' }
    | { __typename: 'RepoAccessAuditEntry' }
    | { __typename: 'RepoAddMemberAuditEntry' }
    | { __typename: 'RepoAddTopicAuditEntry' }
    | { __typename: 'RepoArchivedAuditEntry' }
    | { __typename: 'RepoChangeMergeSettingAuditEntry' }
    | { __typename: 'RepoConfigDisableAnonymousGitAccessAuditEntry' }
    | { __typename: 'RepoConfigDisableCollaboratorsOnlyAuditEntry' }
    | { __typename: 'RepoConfigDisableContributorsOnlyAuditEntry' }
    | { __typename: 'RepoConfigDisableSockpuppetDisallowedAuditEntry' }
    | { __typename: 'RepoConfigEnableAnonymousGitAccessAuditEntry' }
    | { __typename: 'RepoConfigEnableCollaboratorsOnlyAuditEntry' }
    | { __typename: 'RepoConfigEnableContributorsOnlyAuditEntry' }
    | { __typename: 'RepoConfigEnableSockpuppetDisallowedAuditEntry' }
    | { __typename: 'RepoConfigLockAnonymousGitAccessAuditEntry' }
    | { __typename: 'RepoConfigUnlockAnonymousGitAccessAuditEntry' }
    | { __typename: 'RepoCreateAuditEntry' }
    | { __typename: 'RepoDestroyAuditEntry' }
    | { __typename: 'RepoRemoveMemberAuditEntry' }
    | { __typename: 'RepoRemoveTopicAuditEntry' }
    | { __typename: 'Repository', yml:
        | { text: string | null }
        | Record<PropertyKey, never>
       | null, yaml:
        | { text: string | null }
        | Record<PropertyKey, never>
       | null, defaultBranchRef: { branchProtectionRule: { requiredApprovingReviewCount: number | null, requiresStatusChecks: boolean } | null, rules: { nodes: Array<{ type: RepositoryRuleType, parameters:
              | { __typename: 'BranchNamePatternParameters' }
              | { __typename: 'CodeScanningParameters' }
              | { __typename: 'CommitAuthorEmailPatternParameters' }
              | { __typename: 'CommitMessagePatternParameters' }
              | { __typename: 'CommitterEmailPatternParameters' }
              | { __typename: 'FileExtensionRestrictionParameters' }
              | { __typename: 'FilePathRestrictionParameters' }
              | { __typename: 'MaxFilePathLengthParameters' }
              | { __typename: 'MaxFileSizeParameters' }
              | { __typename: 'MergeQueueParameters' }
              | { __typename: 'PullRequestParameters', requiredApprovingReviewCount: number }
              | { __typename: 'RequiredDeploymentsParameters' }
              | { __typename: 'RequiredStatusChecksParameters', requiredStatusChecks: Array<{ context: string }> }
              | { __typename: 'TagNamePatternParameters' }
              | { __typename: 'UpdateParameters' }
              | { __typename: 'WorkflowsParameters' }
             | null } | null> | null } | null } | null }
    | { __typename: 'RepositoryInvitation' }
    | { __typename: 'RepositoryMigration' }
    | { __typename: 'RepositoryRule' }
    | { __typename: 'RepositoryRuleset' }
    | { __typename: 'RepositoryRulesetBypassActor' }
    | { __typename: 'RepositoryTopic' }
    | { __typename: 'RepositoryVisibilityChangeDisableAuditEntry' }
    | { __typename: 'RepositoryVisibilityChangeEnableAuditEntry' }
    | { __typename: 'RepositoryVulnerabilityAlert' }
    | { __typename: 'ReviewDismissalAllowance' }
    | { __typename: 'ReviewDismissedEvent' }
    | { __typename: 'ReviewRequest' }
    | { __typename: 'ReviewRequestRemovedEvent' }
    | { __typename: 'ReviewRequestedEvent' }
    | { __typename: 'SavedReply' }
    | { __typename: 'SecurityAdvisory' }
    | { __typename: 'SponsorsActivity' }
    | { __typename: 'SponsorsListing' }
    | { __typename: 'SponsorsListingFeaturedItem' }
    | { __typename: 'SponsorsTier' }
    | { __typename: 'Sponsorship' }
    | { __typename: 'SponsorshipNewsletter' }
    | { __typename: 'Status' }
    | { __typename: 'StatusCheckRollup' }
    | { __typename: 'StatusContext' }
    | { __typename: 'SubIssueAddedEvent' }
    | { __typename: 'SubIssueRemovedEvent' }
    | { __typename: 'SubscribedEvent' }
    | { __typename: 'Tag' }
    | { __typename: 'Team' }
    | { __typename: 'TeamAddMemberAuditEntry' }
    | { __typename: 'TeamAddRepositoryAuditEntry' }
    | { __typename: 'TeamChangeParentTeamAuditEntry' }
    | { __typename: 'TeamDiscussion' }
    | { __typename: 'TeamDiscussionComment' }
    | { __typename: 'TeamRemoveMemberAuditEntry' }
    | { __typename: 'TeamRemoveRepositoryAuditEntry' }
    | { __typename: 'Topic' }
    | { __typename: 'TransferredEvent' }
    | { __typename: 'Tree' }
    | { __typename: 'UnassignedEvent' }
    | { __typename: 'UnlabeledEvent' }
    | { __typename: 'UnlockedEvent' }
    | { __typename: 'UnmarkedAsDuplicateEvent' }
    | { __typename: 'UnpinnedEvent' }
    | { __typename: 'UnsubscribedEvent' }
    | { __typename: 'User' }
    | { __typename: 'UserBlockedEvent' }
    | { __typename: 'UserContentEdit' }
    | { __typename: 'UserList' }
    | { __typename: 'UserNamespaceRepository' }
    | { __typename: 'UserStatus' }
    | { __typename: 'VerifiableDomain' }
    | { __typename: 'Workflow' }
    | { __typename: 'WorkflowRun' }
    | { __typename: 'WorkflowRunFile' }
   | null> };

export type RepoMetadataFieldsFragment = { yml:
    | { text: string | null }
    | Record<PropertyKey, never>
   | null, yaml:
    | { text: string | null }
    | Record<PropertyKey, never>
   | null, defaultBranchRef: { branchProtectionRule: { requiredApprovingReviewCount: number | null, requiresStatusChecks: boolean } | null, rules: { nodes: Array<{ type: RepositoryRuleType, parameters:
          | { __typename: 'BranchNamePatternParameters' }
          | { __typename: 'CodeScanningParameters' }
          | { __typename: 'CommitAuthorEmailPatternParameters' }
          | { __typename: 'CommitMessagePatternParameters' }
          | { __typename: 'CommitterEmailPatternParameters' }
          | { __typename: 'FileExtensionRestrictionParameters' }
          | { __typename: 'FilePathRestrictionParameters' }
          | { __typename: 'MaxFilePathLengthParameters' }
          | { __typename: 'MaxFileSizeParameters' }
          | { __typename: 'MergeQueueParameters' }
          | { __typename: 'PullRequestParameters', requiredApprovingReviewCount: number }
          | { __typename: 'RequiredDeploymentsParameters' }
          | { __typename: 'RequiredStatusChecksParameters', requiredStatusChecks: Array<{ context: string }> }
          | { __typename: 'TagNamePatternParameters' }
          | { __typename: 'UpdateParameters' }
          | { __typename: 'WorkflowsParameters' }
         | null } | null> | null } | null } | null };

export const RepoMetadataFieldsFragmentDoc = {"kind":"Document","definitions":[{"kind":"FragmentDefinition","name":{"kind":"Name","value":"RepoMetadataFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"Repository"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","alias":{"kind":"Name","value":"yml"},"name":{"kind":"Name","value":"object"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"expression"},"value":{"kind":"StringValue","value":"HEAD:.github/dependabot.yml","block":false}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"Blob"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"text"}}]}}]}},{"kind":"Field","alias":{"kind":"Name","value":"yaml"},"name":{"kind":"Name","value":"object"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"expression"},"value":{"kind":"StringValue","value":"HEAD:.github/dependabot.yaml","block":false}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"Blob"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"text"}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"defaultBranchRef"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"branchProtectionRule"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"requiredApprovingReviewCount"}},{"kind":"Field","name":{"kind":"Name","value":"requiresStatusChecks"}}]}},{"kind":"Field","name":{"kind":"Name","value":"rules"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"20"}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"nodes"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"parameters"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"__typename"}},{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"PullRequestParameters"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"requiredApprovingReviewCount"}}]}},{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"RequiredStatusChecksParameters"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"requiredStatusChecks"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"context"}}]}}]}}]}}]}}]}}]}}]}}]} as unknown as DocumentNode<RepoMetadataFieldsFragment, unknown>;
export const DependabotPrsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"DependabotPrs"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"searchQuery"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"cursor"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"search"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"query"},"value":{"kind":"Variable","name":{"kind":"Name","value":"searchQuery"}}},{"kind":"Argument","name":{"kind":"Name","value":"type"},"value":{"kind":"EnumValue","value":"ISSUE"}},{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"50"}},{"kind":"Argument","name":{"kind":"Name","value":"after"},"value":{"kind":"Variable","name":{"kind":"Name","value":"cursor"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"pageInfo"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"hasNextPage"}},{"kind":"Field","name":{"kind":"Name","value":"endCursor"}}]}},{"kind":"Field","name":{"kind":"Name","value":"nodes"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"PullRequest"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"number"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"state"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"closedAt"}},{"kind":"Field","name":{"kind":"Name","value":"mergedAt"}},{"kind":"Field","name":{"kind":"Name","value":"url"}},{"kind":"Field","name":{"kind":"Name","value":"baseRefName"}},{"kind":"Field","name":{"kind":"Name","value":"headRefName"}},{"kind":"Field","name":{"kind":"Name","value":"mergedBy"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"__typename"}},{"kind":"Field","name":{"kind":"Name","value":"login"}}]}},{"kind":"Field","name":{"kind":"Name","value":"autoMergeRequest"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"enabledAt"}}]}},{"kind":"Field","name":{"kind":"Name","value":"repository"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"owner"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"login"}}]}},{"kind":"Field","name":{"kind":"Name","value":"name"}}]}},{"kind":"Field","name":{"kind":"Name","value":"reviews"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"50"}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"nodes"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"author"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"__typename"}},{"kind":"Field","name":{"kind":"Name","value":"login"}}]}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"comments"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"50"}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"nodes"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"author"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"__typename"}},{"kind":"Field","name":{"kind":"Name","value":"login"}}]}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"commits"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"last"},"value":{"kind":"IntValue","value":"1"}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"nodes"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"commit"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"statusCheckRollup"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"contexts"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"100"}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"nodes"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"__typename"}},{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"CheckRun"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"conclusion"}}]}},{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"StatusContext"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"context"}},{"kind":"Field","name":{"kind":"Name","value":"state"}}]}}]}}]}}]}}]}}]}}]}}]}}]}}]}}]}}]} as unknown as DocumentNode<DependabotPrsQuery, DependabotPrsQueryVariables>;
export const RepoMetadataBatchDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"RepoMetadataBatch"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"ids"}},"type":{"kind":"NonNullType","type":{"kind":"ListType","type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"nodes"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"ids"},"value":{"kind":"Variable","name":{"kind":"Name","value":"ids"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"__typename"}},{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"Repository"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"RepoMetadataFields"}}]}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"RepoMetadataFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"Repository"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","alias":{"kind":"Name","value":"yml"},"name":{"kind":"Name","value":"object"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"expression"},"value":{"kind":"StringValue","value":"HEAD:.github/dependabot.yml","block":false}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"Blob"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"text"}}]}}]}},{"kind":"Field","alias":{"kind":"Name","value":"yaml"},"name":{"kind":"Name","value":"object"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"expression"},"value":{"kind":"StringValue","value":"HEAD:.github/dependabot.yaml","block":false}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"Blob"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"text"}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"defaultBranchRef"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"branchProtectionRule"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"requiredApprovingReviewCount"}},{"kind":"Field","name":{"kind":"Name","value":"requiresStatusChecks"}}]}},{"kind":"Field","name":{"kind":"Name","value":"rules"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"20"}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"nodes"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"parameters"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"__typename"}},{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"PullRequestParameters"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"requiredApprovingReviewCount"}}]}},{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"RequiredStatusChecksParameters"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"requiredStatusChecks"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"context"}}]}}]}}]}}]}}]}}]}}]}}]} as unknown as DocumentNode<RepoMetadataBatchQuery, RepoMetadataBatchQueryVariables>;