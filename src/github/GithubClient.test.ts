import { describe, expect, test } from 'bun:test';
import { partialGraphqlData } from './GithubClient.ts';

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
