import * as Sentry from '@sentry/bun';
import type { BunOptions } from '@sentry/bun';
import { ResultAsync } from 'neverthrow';
import type { Environment } from '../context/Environment.ts';

export interface Telemetry {
  flush(timeoutMs?: number): Promise<void>;
}

interface CreateSentryTelemetryOptions {
  readonly dsn: string;
  readonly anonymousId: string;
  readonly version: string;
}

export function isTelemetryDisabled(env: Environment): boolean {
  return Boolean(env.DO_NOT_TRACK || env.CONTEXTBRIDGE_TELEMETRY_DISABLED || env.CI);
}

export const sentryDataCollection: NonNullable<BunOptions['dataCollection']> = {
  userInfo: false,
  cookies: false,
  httpHeaders: {
    request: { deny: ['forwarded', '-ip', 'remote-', 'via', '-user'] },
    response: { deny: ['forwarded', '-ip', 'remote-', 'via', '-user'] },
  },
  httpBodies: [],
  urlQueryParams: { deny: ['forwarded', '-ip', 'remote-', 'via', '-user'] },
  genAI: { inputs: false, outputs: false },
  databaseQueryData: false,
  graphQL: { document: false, variables: false },
  queues: false,
  stackFrameVariables: true,
  frameContextLines: 7,
};

export function createSentryTelemetry(options: CreateSentryTelemetryOptions): Telemetry {
  const { dsn, anonymousId, version } = options;

  Sentry.init({
    dsn,
    release: version,
    // Sentry only initializes on release builds, which are the only builds with
    // a non-empty DSN baked in (see buildInfo.ts), so the environment is always
    // production when this runs.
    environment: 'production',
    initialScope: {
      tags: { pw_surface: 'cli' },
      user: { id: anonymousId },
    },
    // pinoIntegration subscribes to pino's diagnostics channel; logs at these
    // levels are captured as Sentry error events. Sentry.init must run before
    // the logger is created (see index.ts) so the subscriber is registered
    // before pino emits anything.
    integrations: [Sentry.pinoIntegration({ error: { levels: ['error', 'fatal'] } })],
    // Sentry 11 collects more data by default. Keep the v10 defaults explicit,
    // and disable queue payloads, which did not have a v10 equivalent.
    dataCollection: sentryDataCollection,
    // Default HTTP/console breadcrumbs can contain GitHub API URLs with org and
    // repo names. Drop every breadcrumb to avoid sending those automatically.
    beforeBreadcrumb: () => null,
    // Strip the machine hostname and any captured request data from the event.
    // What remains: the error message/stack, release, environment, anonymous
    // id, and generic OS/runtime context.
    beforeSend: (event) => {
      delete event.server_name;
      delete event.request;
      return event;
    },
  });

  return {
    // Short-lived CLI: flush queued events before the process exits or they are
    // lost. Wrapped in neverthrow so a flush failure can never throw into the
    // exit path.
    flush: async (timeoutMs = 2000): Promise<void> => {
      await ResultAsync.fromPromise(Sentry.flush(timeoutMs), (err: unknown) => err).unwrapOr(undefined);
    },
  };
}

export class NoopTelemetry implements Telemetry {
  async flush(_timeoutMs?: number): Promise<void> {}
}
