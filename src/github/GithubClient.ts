import { graphql as graphqlBase } from '@octokit/graphql';
import { retry } from '@octokit/plugin-retry';
import { throttling } from '@octokit/plugin-throttling';
import { Octokit } from '@octokit/rest';
import { ResultAsync } from 'neverthrow';
import type { Logger } from '../logger.ts';
import { type GithubError, toGithubError } from './errors.ts';

const PatchWaveOctokit = Octokit.plugin(retry, throttling);

/**
 * Narrow GitHub API surface the collectors depend on. Each method returns a
 * ResultAsync so callers can chain without try/catch. Production wires this to
 * Octokit + @octokit/graphql; tests use FakeGithubClient.
 */
export interface GithubClient {
  paginate<T>(route: string, params?: Record<string, unknown>): ResultAsync<T[], GithubError>;
  request<T>(route: string, params?: Record<string, unknown>): ResultAsync<T, GithubError>;
  graphql<T>(query: string, variables?: Record<string, unknown>): ResultAsync<T, GithubError>;
}

export interface GithubClientImplOptions {
  readonly token: string;
  readonly logger: Logger;
  readonly userAgent?: string;
}

export class GithubClientImpl implements GithubClient {
  private readonly rest: InstanceType<typeof PatchWaveOctokit>;
  private readonly graphqlClient: typeof graphqlBase;

  constructor(options: GithubClientImplOptions) {
    const { token, logger, userAgent = 'patchwave-analysis' } = options;
    // `@octokit/request` emits endpoint deprecation notices via `request.log.warn`,
    // which defaults to `console` and so bypasses the top-level `log` below. Pass
    // our logger as `request.log` on each client too, so that noise lands in pino
    // (silent by default) instead of the user's terminal. A child tags the source.
    const log = logger.child({ source: 'octokit' });
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

  paginate<T>(route: string, params: Record<string, unknown> = {}): ResultAsync<T[], GithubError> {
    return ResultAsync.fromPromise(this.rest.paginate(route, params), toGithubError);
  }

  request<T>(route: string, params: Record<string, unknown> = {}): ResultAsync<T, GithubError> {
    return ResultAsync.fromPromise(this.rest.request(route, params), toGithubError).map((res) => res.data as T);
  }

  graphql<T>(query: string, variables: Record<string, unknown> = {}): ResultAsync<T, GithubError> {
    return ResultAsync.fromPromise(this.graphqlClient<T>(query, variables), toGithubError);
  }
}
