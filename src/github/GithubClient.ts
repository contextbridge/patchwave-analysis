import type { TypedDocumentNode } from '@graphql-typed-document-node/core';
import type { PaginatingEndpoints } from '@octokit/plugin-paginate-rest';
import { retry } from '@octokit/plugin-retry';
import { throttling } from '@octokit/plugin-throttling';
import { Octokit } from '@octokit/rest';
import type { Endpoints } from '@octokit/types';
import { print } from 'graphql';
import { type Result, ResultAsync, err, ok } from 'neverthrow';
import type { z } from 'zod';
import type { Logger } from '../logger.ts';
import { type GithubError, toGithubError } from './errors.ts';
import { summarizeIssues, validateItems } from './validateItems.ts';

const PatchWaveOctokit = Octokit.plugin(retry, throttling);

/** Element type of a paginated endpoint's response array. */
export type PaginatedItem<R extends keyof PaginatingEndpoints> =
  PaginatingEndpoints[R]['response']['data'] extends ReadonlyArray<infer U> ? U : never;

/** Narrow GitHub API surface the collectors depend on. */
export interface GithubClient {
  paginate<R extends keyof PaginatingEndpoints, T = PaginatedItem<R>>(
    route: R,
    params?: PaginatingEndpoints[R]['parameters'],
    schema?: z.ZodType<T>,
  ): ResultAsync<T[], GithubError>;
  request<R extends keyof Endpoints>(
    route: R,
    params?: Endpoints[R]['parameters'],
  ): ResultAsync<Endpoints[R]['response']['data'], GithubError>;
  graphql<TResult, TVariables extends Record<string, unknown>>(
    document: TypedDocumentNode<TResult, TVariables>,
    variables: TVariables,
  ): ResultAsync<TResult, GithubError>;
}

export interface GithubClientImplOptions {
  readonly token: string;
  readonly logger: Logger;
  readonly userAgent?: string;
}

export class GithubClientImpl implements GithubClient {
  private readonly rest: InstanceType<typeof PatchWaveOctokit>;
  private readonly log: Logger;

  constructor(options: GithubClientImplOptions) {
    const { token, logger, userAgent = 'patchwave-analysis' } = options;
    // `@octokit/request` emits endpoint deprecation notices via `request.log.warn`,
    // which defaults to `console` and so bypasses the top-level `log` below. Pass
    // our logger as `request.log` on each client too, so that noise lands in pino
    // (silent by default) instead of the user's terminal. A child tags the source.
    const log = logger.child({ source: 'octokit' });
    this.log = log;
    this.rest = new PatchWaveOctokit({
      auth: token,
      userAgent,
      log,
      request: { log },
      retry: { doNotRetry: [400, 401, 403, 404, 409, 422] },
      throttle: {
        onRateLimit: (_retryAfter, _opts, _octokit, retryCount) => retryCount < 2,
        onSecondaryRateLimit: (_retryAfter, _opts, _octokit, retryCount) => retryCount < 2,
      },
    });
  }

  // Keep casts at the Octokit boundary; callers get route-derived types.
  paginate<R extends keyof PaginatingEndpoints, T = PaginatedItem<R>>(
    route: R,
    params?: PaginatingEndpoints[R]['parameters'],
    schema?: z.ZodType<T>,
  ): ResultAsync<T[], GithubError> {
    return ResultAsync.fromPromise(this.rest.paginate(route as string, params ?? {}), toGithubError).map((items) =>
      schema
        ? validateItems(items, schema, (error) =>
            this.log.warn({ route, issues: summarizeIssues(error) }, 'dropped malformed paginate item'),
          )
        : (items as T[]),
    );
  }

  request<R extends keyof Endpoints>(
    route: R,
    params?: Endpoints[R]['parameters'],
  ): ResultAsync<Endpoints[R]['response']['data'], GithubError> {
    return ResultAsync.fromPromise(this.rest.request(route as string, params ?? {}), toGithubError).map(
      (res) => res.data as Endpoints[R]['response']['data'],
    );
  }

  graphql<TResult, TVariables extends Record<string, unknown>>(
    document: TypedDocumentNode<TResult, TVariables>,
    variables: TVariables,
  ): ResultAsync<TResult, GithubError> {
    // GitHub returns partial `data` alongside `errors` when a token can read
    // some fields but not others — e.g. a fine-grained token without Checks
    // access hitting `statusCheckRollup`. Octokit throws on any `errors`, so
    // recover the partial data; one forbidden sub-field shouldn't sink a query
    // whose top-level data (the PR list) came back fine.
    const promise = this.rest.graphql<TResult>(print(document), variables).catch((err: unknown) => {
      const partial = partialGraphqlData<TResult>(err);
      if (partial === undefined) throw err;
      this.log.warn({ errorCount: graphqlErrorCount(err) }, 'GraphQL returned partial data; ignoring forbidden fields');
      return partial;
    });
    return ResultAsync.fromPromise(promise, toGithubError).andThen(graphqlDataOrError);
  }
}

// Octokit's `graphql()` returns `response.data.data` and only throws when the
// body carries an `errors` array. A 200 with an empty or degraded body
// therefore resolves `null`/`undefined`, which the codegen types model as a
// fully-populated object — so collectors that trust the type crash on the first
// field access. Convert a missing payload into a loud Err at the boundary so
// every caller degrades through its normal error channel instead.
export function graphqlDataOrError<T>(data: T | null | undefined): Result<T, GithubError> {
  if (data == null) {
    return err<T, GithubError>({
      kind: 'empty-response',
      message: 'the response body contained no data (likely an empty or degraded reply from GitHub under load)',
    });
  }
  return ok<T, GithubError>(data);
}

// Octokit raises a `GraphqlResponseError` (name set on the instance) that still
// carries the partial `data` payload. Surface that data instead of erroring.
export function partialGraphqlData<T>(err: unknown): T | undefined {
  if (err && typeof err === 'object' && (err as { name?: string }).name === 'GraphqlResponseError') {
    const data = (err as { data?: unknown }).data;
    if (data != null) return data as T;
  }
  return undefined;
}

function graphqlErrorCount(err: unknown): number | undefined {
  const errors = (err as { errors?: unknown }).errors;
  return Array.isArray(errors) ? errors.length : undefined;
}
