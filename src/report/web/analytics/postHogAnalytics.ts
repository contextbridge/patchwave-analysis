import posthog from 'posthog-js/dist/module.full.no-external';
import type { Analytics } from '../../../Analytics.ts';
import type { ReportAnalyticsBuildInfo } from './index.ts';
import { createStableUrlRewriter } from './stableUrlRewriter.ts';

// The subset of posthog-js we touch. Injectable so tests never hit the real singleton/network.
// Return types are widened to `unknown` (we never use them) so a plain fake satisfies it without
// a cast, while the init `config` param keeps its real type so option names stay type-checked.
export interface PostHogBrowserClient {
  init(token: string, config?: NonNullable<Parameters<typeof posthog.init>[1]>): unknown;
  register(properties: Parameters<typeof posthog.register>[0]): void;
  capture(event: Parameters<typeof posthog.capture>[0], properties?: Parameters<typeof posthog.capture>[1]): unknown;
}

export interface CreatePostHogReportAnalyticsOptions {
  readonly buildInfo: ReportAnalyticsBuildInfo;
  readonly reportId: string;
  readonly generatedByAnonId: string;
  readonly version: string;
  readonly client?: PostHogBrowserClient;
}

export function createPostHogReportAnalytics(options: CreatePostHogReportAnalyticsOptions): Analytics {
  const { buildInfo, reportId, generatedByAnonId, version, client = posthog } = options;

  const superProperties: Record<string, unknown> = {
    pw_surface: 'report',
    pw_version: version,
    pw_report_id: reportId,
    pw_generated_by: generatedByAnonId,
  };

  client.init(buildInfo.postHogKey, {
    api_host: buildInfo.postHogHost,
    // The report runs from a file:// page with no reliable storage, so keep identity in memory
    // and seed the distinct id from the report id rather than persisting one per viewer.
    persistence: 'memory',
    bootstrap: { distinctID: reportId },
    // Report copy lives in clickable elements; autocapture would leak it via $elements_text.
    autocapture: false,
    capture_pageview: true,
    // Keep URL/query PII out of event properties and block embedded JSON payloads from replay.
    mask_personal_data_properties: true,
    session_recording: {
      maskAllInputs: true,
      blockSelector: 'script[type="application/json"]',
    },
    advanced_disable_flags: true,
    disable_session_recording: false,
    disable_surveys: true,
    before_send: createStableUrlRewriter(),
  });
  client.register(superProperties);

  return {
    capture: (event, properties) => {
      client.capture(event, { ...superProperties, ...properties });
    },
    register: (properties) => {
      Object.assign(superProperties, properties);
      client.register(properties);
    },
    identify: () => {},
    flush: () => Promise.resolve(),
    shutdown: () => Promise.resolve(),
  };
}
