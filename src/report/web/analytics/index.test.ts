import { describe, expect, test } from 'bun:test';
import { Factory } from 'fishery';
import type { ReportAnalyticsConfig } from '../../reportAnalyticsConfig.ts';
import { type CreateReportAnalyticsOptions, type ReportAnalyticsBuildInfo, createReportAnalytics } from './index.ts';
import type { PostHogBrowserClient } from './postHogAnalytics.ts';

function createFakeClient() {
  const init: Array<{ token: string; config?: unknown }> = [];
  const capture: Array<{ event: string; properties?: unknown }> = [];
  const register: Array<Record<string, unknown>> = [];
  const client: PostHogBrowserClient = {
    init: (token, config) => {
      init.push({ token, config });
    },
    capture: (event, properties) => {
      capture.push({ event: String(event), properties });
    },
    register: (properties) => {
      register.push(properties);
    },
  };
  return { client, init, capture, register };
}

const reportAnalyticsConfig = Factory.define<ReportAnalyticsConfig>(() => ({
  telemetryDisabled: false,
  reportId: 'report-1',
  generatedByAnonId: 'anon-1',
  version: '1.2.3',
}));

const reportAnalyticsBuildInfo = Factory.define<ReportAnalyticsBuildInfo>(() => ({
  postHogKey: 'ph-test',
  postHogHost: 'https://posthog.example.test',
  version: '1.2.3',
}));

const createReportAnalyticsOptions = Factory.define<CreateReportAnalyticsOptions>(() => ({
  config: reportAnalyticsConfig.build(),
  buildInfo: reportAnalyticsBuildInfo.build(),
  client: createFakeClient().client,
}));

describe('createReportAnalytics', () => {
  test('returns noop analytics when embedded telemetry is disabled', () => {
    const fake = createFakeClient();
    const analytics = createReportAnalytics(
      createReportAnalyticsOptions.build({
        config: reportAnalyticsConfig.build({ telemetryDisabled: true }),
        client: fake.client,
      }),
    );

    analytics.capture('report_opened');

    expect(fake.init).toHaveLength(0);
    expect(fake.capture).toHaveLength(0);
  });

  test('returns noop analytics when PostHog was not built in', () => {
    const fake = createFakeClient();
    const analytics = createReportAnalytics(
      createReportAnalyticsOptions.build({
        buildInfo: reportAnalyticsBuildInfo.build({ postHogKey: '' }),
        client: fake.client,
      }),
    );

    analytics.capture('report_opened');

    expect(fake.init).toHaveLength(0);
    expect(fake.capture).toHaveLength(0);
  });

  test('initializes PostHog when all gates are open', () => {
    const fake = createFakeClient();
    const analytics = createReportAnalytics(
      createReportAnalyticsOptions.build({
        client: fake.client,
      }),
    );

    analytics.capture('report_opened');

    expect(fake.init).toHaveLength(1);
    expect(fake.register[0]).toMatchObject({ pw_report_id: 'report-1' });
    expect(fake.capture[0]).toMatchObject({ event: 'report_opened' });
  });
});
