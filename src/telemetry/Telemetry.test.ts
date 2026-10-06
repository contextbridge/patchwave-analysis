import { describe, expect, test } from 'bun:test';
import { NoopTelemetry, isTelemetryDisabled, sentryDataCollection } from './Telemetry.ts';

describe('NoopTelemetry', () => {
  test('flush does nothing observable and never throws', () => {
    const t = new NoopTelemetry();
    expect(t.flush()).resolves.toBeUndefined();
    expect(t.flush(5000)).resolves.toBeUndefined();
  });
});

describe('sentryDataCollection', () => {
  test('preserves the Sentry v10 collection defaults without enabling new v11 data', () => {
    expect(sentryDataCollection).toEqual({
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
    });
  });
});

describe('isTelemetryDisabled', () => {
  test('returns false when no telemetry opt-out is set', () => {
    expect(isTelemetryDisabled(env())).toBe(false);
  });

  test('returns true when any telemetry opt-out is set', () => {
    expect(isTelemetryDisabled(env({ DO_NOT_TRACK: true }))).toBe(true);
    expect(isTelemetryDisabled(env({ CONTEXTBRIDGE_TELEMETRY_DISABLED: true }))).toBe(true);
    expect(isTelemetryDisabled(env({ CI: true }))).toBe(true);
  });
});

function env(
  overrides: Partial<Parameters<typeof isTelemetryDisabled>[0]> = {},
): Parameters<typeof isTelemetryDisabled>[0] {
  return {
    LOG_LEVEL: 'info',
    DO_NOT_TRACK: false,
    CONTEXTBRIDGE_TELEMETRY_DISABLED: false,
    CI: false,
    ...overrides,
  };
}
