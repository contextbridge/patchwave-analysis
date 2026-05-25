// Telemetry credentials are injected at build time via `bun build --define`
// (see .goreleaser.yaml). Local and dev builds lack the defines, so each value
// falls back to an empty string, which disables the corresponding telemetry.
declare const __PW_SENTRY_DSN__: string | undefined;
declare const __PW_POSTHOG_KEY__: string | undefined;
declare const __PW_POSTHOG_HOST__: string | undefined;

export const SENTRY_DSN: string = typeof __PW_SENTRY_DSN__ === 'string' ? __PW_SENTRY_DSN__ : '';
export const POSTHOG_KEY: string = typeof __PW_POSTHOG_KEY__ === 'string' ? __PW_POSTHOG_KEY__ : '';
export const POSTHOG_HOST: string = typeof __PW_POSTHOG_HOST__ === 'string' ? __PW_POSTHOG_HOST__ : '';
