import { describe, expect, test } from 'bun:test';
import { NoopTelemetry } from './Telemetry.ts';

describe('NoopTelemetry', () => {
  test('flush does nothing observable and never throws', () => {
    const t = new NoopTelemetry();
    expect(t.flush()).resolves.toBeUndefined();
    expect(t.flush(5000)).resolves.toBeUndefined();
  });
});
