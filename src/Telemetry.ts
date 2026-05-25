import * as Sentry from '@sentry/bun';
import { ResultAsync } from 'neverthrow';

export interface Telemetry {
  flush(timeoutMs?: number): Promise<void>;
}

export interface CreateSentryTelemetryOptions {
  readonly dsn: string;
  readonly distinctId: string;
  readonly version: string;
}

export function createSentryTelemetry(options: CreateSentryTelemetryOptions): Telemetry {
  const { dsn, distinctId, version } = options;

  Sentry.init({
    dsn,
    release: version,
    // Sentry only initializes on release builds, which are the only builds with
    // a non-empty DSN baked in (see buildInfo.ts), so the environment is always
    // production when this runs.
    environment: 'production',
    initialScope: {
      tags: { pw_surface: 'cli' },
      user: { id: distinctId },
    },
    // pinoIntegration subscribes to pino's diagnostics channel; logs at these
    // levels are captured as Sentry error events. Sentry.init must run before
    // the logger is created (see index.ts) so the subscriber is registered
    // before pino emits anything.
    integrations: [Sentry.pinoIntegration({ error: { levels: ['error', 'fatal'] } })],
    sendDefaultPii: false,
    // Privacy: the default HTTP/console breadcrumbs record the GitHub API URLs
    // we call, which contain org and repo names. Drop every breadcrumb so error
    // reports can't leak them. (The README guarantees we never send these.)
    beforeBreadcrumb: () => null,
    // Strip the machine hostname and any captured request data from the event
    // for the same reason. What remains: the error message/stack, release,
    // environment, the anonymous id, and generic OS/runtime context.
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
