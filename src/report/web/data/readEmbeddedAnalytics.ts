import type { ReportAnalyticsConfig } from '../../reportAnalyticsConfig.ts';

const ELEMENT_ID = 'patchwave-analytics';
const PLACEHOLDER_PREFIX = '__PATCHWAVE_';

const DISABLED: ReportAnalyticsConfig = {
  telemetryDisabled: true,
  reportId: '',
  generatedByAnonId: '',
  version: '',
};

// When the page wasn't produced by the CLI (dev server, tests) the placeholder is unresolved or
// the element is absent — fall back to disabled so nothing is ever sent.
export function parseAnalyticsConfig(text: string | null): ReportAnalyticsConfig {
  if (text == null) return DISABLED;
  const trimmed = text.trim();
  if (trimmed.length === 0 || trimmed.startsWith(PLACEHOLDER_PREFIX)) return DISABLED;
  try {
    return JSON.parse(trimmed) as ReportAnalyticsConfig;
  } catch {
    return DISABLED;
  }
}

export function readEmbeddedAnalytics(): ReportAnalyticsConfig {
  return parseAnalyticsConfig(document.getElementById(ELEMENT_ID)?.textContent ?? null);
}
