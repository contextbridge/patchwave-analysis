import { describe, expect, it } from 'bun:test';
import type { CaptureResult } from 'posthog-js';
import { createStableUrlRewriter } from './stableUrlRewriter.ts';

describe('createStableUrlRewriter', () => {
  const rewriter = createStableUrlRewriter();

  it('collapses a file:// URL (and its path) to the synthetic location', () => {
    const event = buildEvent({
      $current_url: 'file:///Users/someone/Downloads/patchwave-report.html',
      $host: '',
      $pathname: '/Users/someone/Downloads/patchwave-report.html',
    });

    const out = rewriter(event);

    expect(out?.properties['$current_url']).toBe('http://patchwave.local/report');
    expect(out?.properties['$host']).toBe('patchwave.local');
    expect(out?.properties['$pathname']).toBe('/report');
  });

  it('discards query strings and hash fragments', () => {
    const event = buildEvent({ $current_url: 'file:///x/report.html?a=1&b=2#section' });

    const out = rewriter(event);

    expect(out?.properties['$current_url']).toBe('http://patchwave.local/report');
  });

  it('collapses http(s) URLs too (served previews never fragment by port/path)', () => {
    const event = buildEvent({ $current_url: 'http://localhost:60958/foo/bar' });

    const out = rewriter(event);

    expect(out?.properties['$current_url']).toBe('http://patchwave.local/report');
  });

  it('rewrites $referrer and $initial_* URL properties', () => {
    const event = buildEvent({
      $referrer: 'file:///prev/report.html',
      $initial_current_url: 'file:///init/report.html',
      $initial_referrer: 'file:///ref/report.html',
    });

    const out = rewriter(event);

    expect(out?.properties['$referrer']).toBe('http://patchwave.local/report');
    expect(out?.properties['$initial_current_url']).toBe('http://patchwave.local/report');
    expect(out?.properties['$initial_referrer']).toBe('http://patchwave.local/report');
  });

  it('leaves non-URL sentinels like $direct unchanged', () => {
    const event = buildEvent({ $referrer: '$direct' });

    const out = rewriter(event);

    expect(out?.properties['$referrer']).toBe('$direct');
  });

  it('passes through null events', () => {
    expect(rewriter(null)).toBeNull();
  });

  it('ignores non-string URL properties', () => {
    const event = buildEvent({ $current_url: 42, $host: null });

    const out = rewriter(event);

    expect(out?.properties['$current_url']).toBe(42);
    expect(out?.properties['$host']).toBeNull();
  });
});

function buildEvent(properties: Record<string, unknown>): CaptureResult {
  return {
    uuid: 'test-uuid',
    event: '$pageview',
    properties,
  };
}
