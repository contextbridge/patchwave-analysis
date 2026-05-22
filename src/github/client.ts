import { graphql as graphqlBase } from "@octokit/graphql";
import { retry } from "@octokit/plugin-retry";
import { throttling } from "@octokit/plugin-throttling";
import { Octokit } from "@octokit/rest";
import { ResultAsync } from "neverthrow";
import { type GithubError, toGithubError } from "./errors.ts";

const PatchwaveOctokit = Octokit.plugin(retry, throttling);

function noop(): void {}

export interface GithubClient {
  rest: InstanceType<typeof PatchwaveOctokit>;
  graphql: typeof graphqlBase;
}

export function makeClient(token: string): GithubClient {
  const rest = new PatchwaveOctokit({
    auth: token,
    userAgent: "patchwave-analysis",
    log: { debug: noop, info: noop, warn: noop, error: console.error },
    retry: {
      doNotRetry: [400, 401, 403, 404, 409, 422],
    },
    throttle: {
      onRateLimit: (_retryAfter, _options, _octokit, retryCount) => {
        return retryCount < 2;
      },
      onSecondaryRateLimit: () => true,
    },
  });

  const graphql = graphqlBase.defaults({
    headers: { authorization: `token ${token}` },
  });

  return { rest, graphql };
}

export function callRest<T>(promise: Promise<{ data: T }>): ResultAsync<T, GithubError> {
  return ResultAsync.fromPromise(promise, toGithubError).map((res) => res.data);
}

export function callGraphql<T>(promise: Promise<T>): ResultAsync<T, GithubError> {
  return ResultAsync.fromPromise(promise, toGithubError);
}

export function paginateRest<T>(
  client: GithubClient,
  route: string,
  params: Record<string, unknown> = {},
): ResultAsync<T[], GithubError> {
  return ResultAsync.fromPromise(
    client.rest.paginate(route, params) as Promise<T[]>,
    toGithubError,
  );
}
