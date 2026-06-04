import { describe, expect, test } from 'bun:test';
import { NoopAnalytics } from './Analytics.ts';

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
