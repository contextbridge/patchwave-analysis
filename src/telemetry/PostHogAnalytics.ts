import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { ResultAsync, fromThrowable } from 'neverthrow';
import { PostHog } from 'posthog-node';
import { POSTHOG_HOST, POSTHOG_KEY } from '../buildInfo.ts';
import type { Analytics } from './Analytics.ts';

const APP_DIR_NAME = 'contextbridge';
const ANONYMOUS_ID_FILE_NAME = 'anonymous_id';

export type PostHogClient = Pick<PostHog, 'identify' | 'capture' | 'flush' | 'shutdown'>;

interface AnonymousIdEnv {
  readonly XDG_CONFIG_HOME?: string;
  readonly HOME?: string;
}

interface AnalyticsImplOptions {
  readonly anonymousId: string;
  readonly version: string;
  readonly client?: PostHogClient;
}

const safeReadAnonymousId = fromThrowable((path: string) => readFileSync(path, 'utf8').trim());
const safeWriteAnonymousId = fromThrowable((dir: string, path: string, id: string) => {
  mkdirSync(dir, { recursive: true });
  writeFileSync(path, `${id}\n`, { encoding: 'utf8', mode: 0o600 });
});

export function getOrCreateAnonymousId(env: AnonymousIdEnv): string {
  const dir = configDir(env);
  const path = join(dir, ANONYMOUS_ID_FILE_NAME);

  const existing = safeReadAnonymousId(path).unwrapOr('');
  if (existing.length > 0) return existing;

  const id = crypto.randomUUID();
  // A read-only filesystem shouldn't break telemetry — discard the write
  // Result and return the generated id either way.
  safeWriteAnonymousId(dir, path, id);
  return id;
}

export class AnalyticsImpl implements Analytics {
  readonly #anonymousId: string;
  readonly #client: PostHogClient;
  readonly #superProperties: Record<string, unknown>;
  readonly #safeIdentify: (input: Parameters<PostHogClient['identify']>[0]) => void;
  readonly #safeCapture: (input: Parameters<PostHogClient['capture']>[0]) => void;

  constructor(options: AnalyticsImplOptions) {
    this.#anonymousId = options.anonymousId;
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

  identify(anonymousId: string, properties?: Record<string, unknown>): void {
    this.#safeIdentify({
      distinctId: anonymousId,
      properties: { ...this.#superProperties, ...properties },
    });
  }

  capture(event: string, properties?: Record<string, unknown>): void {
    this.#safeCapture({
      distinctId: this.#anonymousId,
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

function createDefaultClient(): PostHog {
  return new PostHog(POSTHOG_KEY, {
    host: POSTHOG_HOST,
    // Short flush window for short-lived CLI processes; flushAt=1 sends eagerly.
    flushAt: 1,
    flushInterval: 1000,
  });
}

function configDir(env: AnonymousIdEnv): string {
  if (env.XDG_CONFIG_HOME && env.XDG_CONFIG_HOME.length > 0) {
    return join(env.XDG_CONFIG_HOME, APP_DIR_NAME);
  }
  const home = env.HOME && env.HOME.length > 0 ? env.HOME : homedir();
  return join(home, '.config', APP_DIR_NAME);
}
