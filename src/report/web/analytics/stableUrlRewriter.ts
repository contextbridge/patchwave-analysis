import type { BeforeSendFn } from 'posthog-js';

// The report is opened directly from disk (file://), so posthog-js would otherwise stamp the
// viewer's local filesystem path onto $current_url/$pathname — leaking the path and fragmenting
// every report into its own URL. Collapse all URL-shaped properties to one synthetic location.
//
// NOTE: this differs from planbridge's rewriter, which preserves the pathname because its UI is
// served over localhost where the pathname is a real route. Here the pathname is a file path, so
// we discard it entirely.
const SYNTHETIC_URL = 'http://patchwave.local/report';
const SYNTHETIC_HOST = 'patchwave.local';
const SYNTHETIC_PATH = '/report';
const URL_PROPERTY_KEYS = ['$current_url', '$referrer', '$initial_current_url', '$initial_referrer'] as const;

export function createStableUrlRewriter(): BeforeSendFn {
  return (event) => {
    if (event == null) return event;
    const props = event.properties;
    if (props == null) return event;

    for (const key of URL_PROPERTY_KEYS) {
      const value: unknown = props[key];
      // Only rewrite genuine URLs; sentinels like '$direct' aren't parseable and are left alone.
      if (typeof value === 'string' && URL.canParse(value)) {
        props[key] = SYNTHETIC_URL;
      }
    }
    if (typeof props['$host'] === 'string') props['$host'] = SYNTHETIC_HOST;
    if (typeof props['$pathname'] === 'string') props['$pathname'] = SYNTHETIC_PATH;

    return event;
  };
}
