import { ResultAsync, fromThrowable } from 'neverthrow';
import { PostHog } from 'posthog-node';
import { POSTHOG_HOST, POSTHOG_KEY } from './buildInfo.ts';

export interface Analytics {
  identify(distinctId: string, properties?: Record<string, unknown>): void;
  capture(event: string, properties?: Record<string, unknown>): void;
  register(properties: Record<string, unknown>): void;
  flush(): Promise<void>;
  shutdown(): Promise<void>;
}

export type PostHogClient = Pick<PostHog, 'identify' | 'capture' | 'flush' | 'shutdown'>;

export interface AnalyticsImplOptions {
  readonly distinctId: string;
  readonly version: string;
  readonly client?: PostHogClient;
}

export class AnalyticsImpl implements Analytics {
  readonly #distinctId: string;
  readonly #client: PostHogClient;
  readonly #superProperties: Record<string, unknown>;
  readonly #safeIdentify: (input: Parameters<PostHogClient['identify']>[0]) => void;
  readonly #safeCapture: (input: Parameters<PostHogClient['capture']>[0]) => void;

  constructor(options: AnalyticsImplOptions) {
    this.#distinctId = options.distinctId;
    this.#client = options.client ?? createDefaultClient();
    this.#superProperties = {
      pw_surface: 'cli',
      pw_version: options.version,
    };
    // Wrap PostHog calls in neverthrow so a telemetry failure (network, bad
    // payload) is explicit and can never escape into the CLI's control flow.
    const safeIdentify = fromThrowable(this.#client.identify.bind(this.#client));
    const safeCapture = fromThrowable(this.#client.capture.bind(this.#client));
    this.#safeIdentify = (input) => {
      void safeIdentify(input);
    };
    this.#safeCapture = (input) => {
      void safeCapture(input);
    };
  }

  identify(distinctId: string, properties?: Record<string, unknown>): void {
    this.#safeIdentify({
      distinctId,
      properties: { ...this.#superProperties, ...properties },
    });
  }

  capture(event: string, properties?: Record<string, unknown>): void {
    this.#safeCapture({
      distinctId: this.#distinctId,
      event,
      properties: { ...this.#superProperties, ...properties },
    });
  }

  register(properties: Record<string, unknown>): void {
    Object.assign(this.#superProperties, properties);
  }

  async flush(): Promise<void> {
    await ResultAsync.fromPromise(this.#client.flush(), (err: unknown) => err).unwrapOr(undefined);
  }

  async shutdown(): Promise<void> {
    await ResultAsync.fromPromise(this.#client.shutdown(), (err: unknown) => err).unwrapOr(undefined);
  }
}

export class NoopAnalytics implements Analytics {
  identify(_distinctId: string, _properties?: Record<string, unknown>): void {}
  capture(_event: string, _properties?: Record<string, unknown>): void {}
  register(_properties: Record<string, unknown>): void {}
  async flush(): Promise<void> {}
  async shutdown(): Promise<void> {}
}

function createDefaultClient(): PostHog {
  return new PostHog(POSTHOG_KEY, {
    host: POSTHOG_HOST,
    // Short flush window for short-lived CLI processes; flushAt=1 sends eagerly.
    flushAt: 1,
    flushInterval: 1000,
  });
}
