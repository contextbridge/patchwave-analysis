/** Internal type. DO NOT USE DIRECTLY. */
type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
/** Internal type. DO NOT USE DIRECTLY. */
export type Incremental<T> = T | { [P in keyof T]?: P extends ' $fragmentName' | '__typename' ? T[P] : never };
import type { TypedDocumentNode as DocumentNode } from '@graphql-typed-document-node/core';
/** The possible states of a pull request. */
export type PullRequestState =
  /** A pull request that has been closed without being merged. */
  | 'CLOSED'
  /** A pull request that has been closed by being merged. */
  | 'MERGED'
  /** A pull request that is still open. */
  | 'OPEN';

export type DependabotPrsSearchQueryVariables = Exact<{
  searchQuery: string;
  cursor?: string | null | undefined;
}>;


export type DependabotPrsSearchQuery = { search: { issueCount: number, pageInfo: { hasNextPage: boolean, endCursor: string | null }, nodes: Array<
      | { __typename: 'App' }
      | { __typename: 'Discussion' }
      | { __typename: 'Issue' }
      | { __typename: 'MarketplaceListing' }
      | { __typename: 'Organization' }
      | { __typename: 'PullRequest', number: number, title: string, state: PullRequestState, createdAt: string, closedAt: string | null, mergedAt: string | null, url: string, baseRefName: string, headRefName: string, repository: { name: string, owner:
            | { login: string }
            | { login: string }
           }, author:
          | { __typename: 'Bot', login: string }
          | { __typename: 'EnterpriseUserAccount', login: string }
          | { __typename: 'Mannequin', login: string }
          | { __typename: 'Organization', login: string }
          | { __typename: 'User', login: string }
         | null, mergedBy:
          | { __typename: 'Bot', login: string }
          | { __typename: 'EnterpriseUserAccount', login: string }
          | { __typename: 'Mannequin', login: string }
          | { __typename: 'Organization', login: string }
          | { __typename: 'User', login: string }
         | null, autoMergeRequest: { enabledAt: string | null } | null, reviews: { nodes: Array<{ author:
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
             | null } | null> | null } }
      | { __typename: 'Repository' }
      | { __typename: 'User' }
     | null> | null } };


export const DependabotPrsSearchDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"DependabotPrsSearch"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"searchQuery"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"cursor"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"search"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"query"},"value":{"kind":"Variable","name":{"kind":"Name","value":"searchQuery"}}},{"kind":"Argument","name":{"kind":"Name","value":"type"},"value":{"kind":"EnumValue","value":"ISSUE"}},{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"100"}},{"kind":"Argument","name":{"kind":"Name","value":"after"},"value":{"kind":"Variable","name":{"kind":"Name","value":"cursor"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"issueCount"}},{"kind":"Field","name":{"kind":"Name","value":"pageInfo"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"hasNextPage"}},{"kind":"Field","name":{"kind":"Name","value":"endCursor"}}]}},{"kind":"Field","name":{"kind":"Name","value":"nodes"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"__typename"}},{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"PullRequest"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"number"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"state"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"closedAt"}},{"kind":"Field","name":{"kind":"Name","value":"mergedAt"}},{"kind":"Field","name":{"kind":"Name","value":"url"}},{"kind":"Field","name":{"kind":"Name","value":"baseRefName"}},{"kind":"Field","name":{"kind":"Name","value":"headRefName"}},{"kind":"Field","name":{"kind":"Name","value":"repository"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"owner"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"login"}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"author"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"__typename"}},{"kind":"Field","name":{"kind":"Name","value":"login"}}]}},{"kind":"Field","name":{"kind":"Name","value":"mergedBy"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"__typename"}},{"kind":"Field","name":{"kind":"Name","value":"login"}}]}},{"kind":"Field","name":{"kind":"Name","value":"autoMergeRequest"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"enabledAt"}}]}},{"kind":"Field","name":{"kind":"Name","value":"reviews"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"20"}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"nodes"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"author"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"__typename"}},{"kind":"Field","name":{"kind":"Name","value":"login"}}]}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"comments"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"20"}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"nodes"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"author"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"__typename"}},{"kind":"Field","name":{"kind":"Name","value":"login"}}]}}]}}]}}]}}]}}]}}]}}]} as unknown as DocumentNode<DependabotPrsSearchQuery, DependabotPrsSearchQueryVariables>;