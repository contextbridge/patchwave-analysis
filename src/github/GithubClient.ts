import { graphql as graphqlBase } from '@octokit/graphql';
import { retry } from '@octokit/plugin-retry';
import { throttling } from '@octokit/plugin-throttling';
import { Octokit } from '@octokit/rest';
import { ResultAsync } from 'neverthrow';
import type { Logger } from '../logger.ts';
import { type GithubError, toGithubError } from './errors.ts';

const PatchwaveOctokit = Octokit.plugin(retry, throttling);

function noop(): void {}

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
  private readonly rest: InstanceType<typeof PatchwaveOctokit>;
  private readonly graphqlClient: typeof graphqlBase;

  constructor(options: GithubClientImplOptions) {
    const { token, logger, userAgent = 'patchwave-analysis' } = options;
    this.rest = new PatchwaveOctokit({
      auth: token,
      userAgent,
      log: {
        debug: noop,
        info: noop,
        warn: noop,
        // octokit emits an `error` for every non-2xx response, but most of
        // those are expected partial failures (404 on a missing
        // dependabot.yml, 403 on a repo the token can't read alerts for).
        // The real partial-failure boundary lives in `cli.ts#crawlPerRepo`
        // and records a warning into the bundle; here we keep the noise out
        // of the interactive UX unless the user asks for it.
        error: (msg: string) => logger.debug({ source: 'octokit' }, msg),
      },
      retry: { doNotRetry: [400, 401, 403, 404, 409, 422] },
      throttle: {
        onRateLimit: (_retryAfter, _opts, _octokit, retryCount) => retryCount < 2,
        onSecondaryRateLimit: () => true,
      },
    });
    this.graphqlClient = graphqlBase.defaults({
      headers: { authorization: `token ${token}` },
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
