import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, test } from 'bun:test';
import { AnalyticsImpl, type PostHogClient, getOrCreateAnonymousId } from './PostHogAnalytics.ts';

interface RecordedIdentify {
  readonly anonymousId: string | undefined;
  readonly properties?: Record<string, unknown>;
}

interface RecordedCapture {
  readonly anonymousId: string | undefined;
  readonly event: string;
  readonly properties?: Record<string, unknown>;
}

interface FakeClient {
  readonly client: PostHogClient;
  readonly identify: RecordedIdentify[];
  readonly capture: RecordedCapture[];
}

describe('AnalyticsImpl', () => {
  test('stamps surface and version on identify and capture', () => {
    const fake = createFakeClient();
    const a = new AnalyticsImpl({ anonymousId: 'user-1', version: '0.0.1', client: fake.client });

    a.identify('user-1');
    a.capture('run_started', { foo: 'bar' });

    expect(fake.identify[0]).toMatchObject({
      anonymousId: 'user-1',
      properties: { pw_surface: 'cli', pw_version: '0.0.1' },
    });
    expect(fake.capture[0]).toMatchObject({
      anonymousId: 'user-1',
      event: 'run_started',
      properties: { pw_surface: 'cli', pw_version: '0.0.1', foo: 'bar' },
    });
  });

  test('register merges into subsequent calls', () => {
    const fake = createFakeClient();
    const a = new AnalyticsImpl({ anonymousId: 'user-1', version: '0.0.1', client: fake.client });

    a.register({ pw_command: 'run' });
    a.capture('event');

    expect(fake.capture[0]?.properties).toMatchObject({ pw_command: 'run' });
  });

  test('capture always uses the constructor anonymousId', () => {
    const fake = createFakeClient();
    const a = new AnalyticsImpl({ anonymousId: 'original', version: '0.0.1', client: fake.client });

    a.identify('different');
    a.capture('event');

    expect(fake.capture[0]?.anonymousId).toBe('original');
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
    const a = new AnalyticsImpl({ anonymousId: 'user-1', version: '0.0.1', client: throwing });

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
    const a = new AnalyticsImpl({ anonymousId: 'user-1', version: '0.0.1', client: rejecting });

    expect(a.flush()).resolves.toBeUndefined();
    expect(a.shutdown()).resolves.toBeUndefined();
  });
});

describe('getOrCreateAnonymousId', () => {
  test('creates a new UUID when the file is missing and persists it', () => {
    using handle = createAnonymousIdTestDir();

    const id = getOrCreateAnonymousId({ XDG_CONFIG_HOME: handle.dir });

    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
    const persisted = readFileSync(join(handle.dir, 'contextbridge', 'anonymous_id'), 'utf8').trim();
    expect(persisted).toBe(id);
  });

  test('returns the existing id on subsequent calls', () => {
    using handle = createAnonymousIdTestDir();

    const first = getOrCreateAnonymousId({ XDG_CONFIG_HOME: handle.dir });
    const second = getOrCreateAnonymousId({ XDG_CONFIG_HOME: handle.dir });

    expect(second).toBe(first);
  });

  test('falls back to $HOME/.config when XDG_CONFIG_HOME is unset', () => {
    using handle = createAnonymousIdTestDir();

    const id = getOrCreateAnonymousId({ HOME: handle.dir });

    expect(id.length).toBeGreaterThan(0);
    const persisted = readFileSync(join(handle.dir, '.config', 'contextbridge', 'anonymous_id'), 'utf8').trim();
    expect(persisted).toBe(id);
  });

  test('reads a pre-existing id file written by another tool', async () => {
    using handle = createAnonymousIdTestDir();
    await Bun.write(join(handle.dir, 'contextbridge', 'anonymous_id'), 'preexisting-id\n');

    const id = getOrCreateAnonymousId({ XDG_CONFIG_HOME: handle.dir });

    expect(id).toBe('preexisting-id');
  });
});

function createFakeClient(): FakeClient {
  const identify: RecordedIdentify[] = [];
  const capture: RecordedCapture[] = [];
  return {
    identify,
    capture,
    client: {
      identify: (input) => {
        identify.push({ anonymousId: input.distinctId, properties: input.properties });
      },
      capture: (input) => {
        capture.push({ anonymousId: input.distinctId, event: input.event, properties: input.properties });
      },
      flush: () => Promise.resolve(),
      shutdown: () => Promise.resolve(),
    },
  };
}

function createAnonymousIdTestDir(): Disposable & { readonly dir: string } {
  const dir = mkdtempSync(join(tmpdir(), 'patchwave-anonid-'));
  return {
    dir,
    [Symbol.dispose]: () => {
      rmSync(dir, { recursive: true, force: true });
    },
  };
}
