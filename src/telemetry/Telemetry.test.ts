import { describe, expect, test } from 'bun:test';
import { NoopTelemetry, isTelemetryDisabled } from './Telemetry.ts';

describe('NoopTelemetry', () => {
  test('flush does nothing observable and never throws', () => {
    const t = new NoopTelemetry();
    expect(t.flush()).resolves.toBeUndefined();
    expect(t.flush(5000)).resolves.toBeUndefined();
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
