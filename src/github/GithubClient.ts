import type { TypedDocumentNode } from '@graphql-typed-document-node/core';
import { graphql as graphqlBase } from '@octokit/graphql';
import type { PaginatingEndpoints } from '@octokit/plugin-paginate-rest';
import { retry } from '@octokit/plugin-retry';
import { throttling } from '@octokit/plugin-throttling';
import { Octokit } from '@octokit/rest';
import type { Endpoints } from '@octokit/types';
import { print } from 'graphql';
import { ResultAsync } from 'neverthrow';
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
  private readonly graphqlClient: typeof graphqlBase;
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
        onSecondaryRateLimit: () => true,
      },
    });
    this.graphqlClient = graphqlBase.defaults({
      headers: { authorization: `token ${token}` },
      request: { log },
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
    return ResultAsync.fromPromise(this.graphqlClient<TResult>(print(document), variables), toGithubError);
  }
}
