import { describe, expect, test } from 'bun:test';
import { AnalyticsImpl, NoopAnalytics, type PostHogClient } from './Analytics.ts';

interface RecordedIdentify {
  readonly distinctId: string | undefined;
  readonly properties?: Record<string, unknown>;
}

interface RecordedCapture {
  readonly distinctId: string | undefined;
  readonly event: string;
  readonly properties?: Record<string, unknown>;
}

interface FakeClient {
  readonly client: PostHogClient;
  readonly identify: RecordedIdentify[];
  readonly capture: RecordedCapture[];
}

function createFakeClient(): FakeClient {
  const identify: RecordedIdentify[] = [];
  const capture: RecordedCapture[] = [];
  return {
    identify,
    capture,
    client: {
      identify: (input) => {
        identify.push({ distinctId: input.distinctId, properties: input.properties });
      },
      capture: (input) => {
        capture.push({ distinctId: input.distinctId, event: input.event, properties: input.properties });
      },
      flush: () => Promise.resolve(),
      shutdown: () => Promise.resolve(),
    },
  };
}

describe('AnalyticsImpl', () => {
  test('stamps surface and version on identify and capture', () => {
    const fake = createFakeClient();
    const a = new AnalyticsImpl({ distinctId: 'user-1', version: '0.0.1', client: fake.client });

    a.identify('user-1');
    a.capture('run_started', { foo: 'bar' });

    expect(fake.identify[0]).toMatchObject({
      distinctId: 'user-1',
      properties: { pw_surface: 'cli', pw_version: '0.0.1' },
    });
    expect(fake.capture[0]).toMatchObject({
      distinctId: 'user-1',
      event: 'run_started',
      properties: { pw_surface: 'cli', pw_version: '0.0.1', foo: 'bar' },
    });
  });

  test('register merges into subsequent calls', () => {
    const fake = createFakeClient();
    const a = new AnalyticsImpl({ distinctId: 'user-1', version: '0.0.1', client: fake.client });

    a.register({ pw_command: 'run' });
    a.capture('event');

    expect(fake.capture[0]?.properties).toMatchObject({ pw_command: 'run' });
  });

  test('capture always uses the constructor distinctId', () => {
    const fake = createFakeClient();
    const a = new AnalyticsImpl({ distinctId: 'original', version: '0.0.1', client: fake.client });

    a.identify('different');
    a.capture('event');

    expect(fake.capture[0]?.distinctId).toBe('original');
  });

  test('swallows thrown client errors so telemetry never breaks the CLI', () => {
    const throwing: PostHogClient = {
      identify: () => {
        throw new Error('boom');
      },
      capture: () => {
        throw new Error('boom');
      },
      flush: () => Promise.resolve(),
      shutdown: () => Promise.resolve(),
    };
    const a = new AnalyticsImpl({ distinctId: 'user-1', version: '0.0.1', client: throwing });

    expect(() => a.identify('user-1')).not.toThrow();
    expect(() => a.capture('event')).not.toThrow();
  });

  test('flush and shutdown swallow rejected promises', () => {
    const rejecting: PostHogClient = {
      identify: () => {},
      capture: () => {},
      flush: () => Promise.reject(new Error('flush boom')),
      shutdown: () => Promise.reject(new Error('shutdown boom')),
    };
    const a = new AnalyticsImpl({ distinctId: 'user-1', version: '0.0.1', client: rejecting });

    expect(a.flush()).resolves.toBeUndefined();
    expect(a.shutdown()).resolves.toBeUndefined();
  });
});

describe('NoopAnalytics', () => {
  test('does nothing observable and never throws', () => {
    const a = new NoopAnalytics();
    expect(() => a.identify('x')).not.toThrow();
    expect(() => a.capture('e')).not.toThrow();
    expect(() => a.register({ k: 'v' })).not.toThrow();
    expect(a.flush()).resolves.toBeUndefined();
    expect(a.shutdown()).resolves.toBeUndefined();
  });
});
