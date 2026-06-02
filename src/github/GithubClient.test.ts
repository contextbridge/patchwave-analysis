import { describe, expect, test } from 'bun:test';
import { graphqlDataOrError, partialGraphqlData } from './GithubClient.ts';

describe('partialGraphqlData', () => {
  test('recovers partial data from a GraphqlResponseError', () => {
    // GitHub returns usable `data` plus `errors` when a token can read some
    // fields but not others (e.g. no Checks access on statusCheckRollup).
    const err = {
      name: 'GraphqlResponseError',
      data: { nodes: [{ __typename: 'Repository' }] },
      errors: [{ type: 'FORBIDDEN', message: 'Resource not accessible by personal access token' }],
    };
    expect(partialGraphqlData<{ nodes: Array<{ __typename: string }> }>(err)).toEqual({
      nodes: [{ __typename: 'Repository' }],
    });
  });

  test('returns undefined when the GraphQL error carries no data', () => {
    expect(
      partialGraphqlData({ name: 'GraphqlResponseError', data: null, errors: [{ message: 'boom' }] }),
    ).toBeUndefined();
  });

  test('returns undefined for non-GraphQL errors so they propagate', () => {
    expect(partialGraphqlData({ name: 'HttpError', status: 502, data: undefined })).toBeUndefined();
    expect(partialGraphqlData(new Error('network'))).toBeUndefined();
    expect(partialGraphqlData(undefined)).toBeUndefined();
  });
});

describe('graphqlDataOrError', () => {
  // Octokit's `graphql()` returns `response.data.data` and only throws when an
  // `errors` array is present. A 200 with an empty/degraded body therefore
  // resolves `undefined`/`null` — which used to flow into collectors as a real
  // object and crash on `res.nodes`. Convert it to a loud Err at the boundary.
  test('passes a real data object through as Ok', () => {
    const data = { nodes: [{ __typename: 'Repository' }] };
    const result = graphqlDataOrError(data);
    expect(result.isOk()).toBe(true);
    expect(result.unwrapOr(null)).toBe(data);
  });

  test('turns null data into an empty-response error', () => {
    const result = graphqlDataOrError(null);
    expect(result.isErr()).toBe(true);
    if (result.isErr()) expect(result.error.kind).toBe('empty-response');
  });

  test('turns undefined data into an empty-response error', () => {
    const result = graphqlDataOrError(undefined);
    expect(result.isErr()).toBe(true);
    if (result.isErr()) expect(result.error.kind).toBe('empty-response');
  });
});
