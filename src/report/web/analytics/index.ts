import { type Analytics, createNoopAnalytics } from '../../../Analytics.ts';
import type { ReportAnalyticsConfig } from '../../reportAnalyticsConfig.ts';
import { type PostHogBrowserClient, createPostHogReportAnalytics } from './postHogAnalytics.ts';

export interface ReportAnalyticsBuildInfo {
  readonly postHogKey: string;
  readonly postHogHost: string;
  readonly version: string;
}

export interface CreateReportAnalyticsOptions {
  readonly config: ReportAnalyticsConfig;
  readonly buildInfo: ReportAnalyticsBuildInfo;
  readonly client?: PostHogBrowserClient;
}

export function createReportAnalytics(options: CreateReportAnalyticsOptions): Analytics {
  const { config, buildInfo, client } = options;
  // An empty key means PostHog wasn't built in (local/dev build); skip it so we never
  // initialize the client with ''. Mirrors the CLI gate in index.ts.
  if (config.telemetryDisabled || buildInfo.postHogKey === '') {
    return createNoopAnalytics();
  }
  return createPostHogReportAnalytics({
    buildInfo,
    reportId: config.reportId,
    generatedByAnonId: config.generatedByAnonId,
    version: config.version || buildInfo.version,
    client,
  });
}
