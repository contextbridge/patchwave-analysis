import { Result, ResultAsync, errAsync, okAsync } from 'neverthrow';
import { z } from 'zod';
import { type Instant, Temporal } from '../time.ts';
import type { GithubError } from './errors.ts';
import type { GithubClient } from './GithubClient.ts';

export interface RateLimitBucket {
  readonly limit: number;
  readonly remaining: number;
  readonly used: number;
  readonly resetAt: Instant;
}

export interface RateLimitStatus {
  readonly rest: RateLimitBucket;
  readonly graphql: RateLimitBucket;
}

const bucketSchema = z.object({ limit: z.number(), remaining: z.number(), used: z.number(), reset: z.number() });
const rateLimitSchema = z.object({ resources: z.object({ core: bucketSchema, graphql: bucketSchema }) });

export function getRateLimitStatus(client: GithubClient): ResultAsync<RateLimitStatus, GithubError> {
  return client.request('GET /rate_limit').andThen((raw) => {
    const parsed = Result.fromThrowable(
      () => rateLimitSchema.parse(raw),
      (): GithubError => ({
        kind: 'malformed-response',
        message: 'GitHub returned malformed data for rate-limit status',
      }),
    )();
    if (parsed.isErr()) return errAsync(parsed.error);
    return okAsync({ rest: toBucket(parsed.value.resources.core), graphql: toBucket(parsed.value.resources.graphql) });
  });
}

function toBucket(raw: z.infer<typeof bucketSchema>): RateLimitBucket {
  return {
    limit: raw.limit,
    remaining: raw.remaining,
    used: raw.used,
    resetAt: Temporal.Instant.fromEpochMilliseconds(raw.reset * 1000),
  };
}
