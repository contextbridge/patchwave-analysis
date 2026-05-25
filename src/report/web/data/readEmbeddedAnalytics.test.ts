import { describe, expect, test } from 'bun:test';
import { parseAnalyticsConfig } from './readEmbeddedAnalytics.ts';

describe('parseAnalyticsConfig', () => {
  test('parses an embedded config', () => {
    const config = parseAnalyticsConfig(
      JSON.stringify({
        telemetryDisabled: false,
        reportId: 'report-1',
        generatedByAnonId: 'anon-1',
        version: '0.0.1',
      }),
    );

    expect(config).toEqual({
      telemetryDisabled: false,
      reportId: 'report-1',
      generatedByAnonId: 'anon-1',
      version: '0.0.1',
    });
  });

  test('falls back to disabled when the element is absent', () => {
    expect(parseAnalyticsConfig(null).telemetryDisabled).toBe(true);
  });

  test('falls back to disabled when the placeholder is unresolved (dev/test)', () => {
    expect(parseAnalyticsConfig('__PATCHWAVE_ANALYTICS__').telemetryDisabled).toBe(true);
  });

  test('falls back to disabled for empty content', () => {
    expect(parseAnalyticsConfig('   \n  ').telemetryDisabled).toBe(true);
  });

  test('falls back to disabled for malformed JSON', () => {
    expect(parseAnalyticsConfig('{not json').telemetryDisabled).toBe(true);
  });
});
