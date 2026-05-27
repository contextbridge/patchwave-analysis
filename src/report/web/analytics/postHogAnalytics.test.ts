import { describe, expect, test } from 'bun:test';
import { Factory } from 'fishery';
import { type PostHogBrowserClient, createPostHogReportAnalytics } from './postHogAnalytics.ts';

interface InitCall {
  readonly token: string;
  readonly config: Record<string, unknown>;
}

function createFakeClient() {
  const init: InitCall[] = [];
  const register: Array<Record<string, unknown>> = [];
  const capture: Array<{ event: string; properties?: Record<string, unknown> | null }> = [];
  const client: PostHogBrowserClient = {
    init: (token, config) => {
      init.push({ token, config: { ...config } });
    },
    register: (properties) => {
      register.push(properties);
    },
    capture: (event, properties) => {
      capture.push({ event: String(event), properties: properties ?? undefined });
    },
  };
  return { client, init, register, capture };
}

const postHogReportAnalyticsOptions = Factory.define<Parameters<typeof createPostHogReportAnalytics>[0]>(() => ({
  buildInfo: { postHogKey: 'ph-test', postHogHost: 'https://posthog.example.test', version: '1.2.3' },
  reportId: 'report-123',
  generatedByAnonId: 'anon-456',
  version: '1.2.3',
}));

describe('createPostHogReportAnalytics', () => {
  test('initializes posthog for the file:// report environment', () => {
    const fake = createFakeClient();
    createPostHogReportAnalytics(postHogReportAnalyticsOptions.build({ client: fake.client }));

    expect(fake.init[0]?.token).toBe('ph-test');
    expect(fake.init[0]?.config).toMatchObject({
      api_host: 'https://posthog.example.test',
      persistence: 'memory',
      autocapture: false,
      advanced_disable_flags: true,
      disable_session_recording: false,
      disable_surveys: true,
      mask_personal_data_properties: true,
      session_recording: {
        maskAllInputs: true,
        blockSelector: 'script[type="application/json"]',
      },
      bootstrap: { distinctID: 'anon-456' },
    });
    expect(fake.init[0]?.config['before_send']).toBeDefined();
  });

  test('falls back to the report id as the distinct id when no anon id was embedded', () => {
    const fake = createFakeClient();
    createPostHogReportAnalytics(postHogReportAnalyticsOptions.build({ client: fake.client, generatedByAnonId: '' }));

    expect(fake.init[0]?.config['bootstrap']).toEqual({ distinctID: 'report-123' });
  });

  test('registers the pw_* super-properties', () => {
    const fake = createFakeClient();
    createPostHogReportAnalytics(postHogReportAnalyticsOptions.build({ client: fake.client }));

    expect(fake.register[0]).toMatchObject({
      pw_surface: 'report',
      pw_version: '1.2.3',
      pw_report_id: 'report-123',
    });
  });

  test('capture forwards the event with super-properties merged in', () => {
    const fake = createFakeClient();
    const analytics = createPostHogReportAnalytics(postHogReportAnalyticsOptions.build({ client: fake.client }));

    analytics.capture('cta_clicked', { which: 'verdict_primary' });

    expect(fake.capture[0]).toMatchObject({
      event: 'cta_clicked',
      properties: { pw_surface: 'report', pw_report_id: 'report-123', which: 'verdict_primary' },
    });
  });
});
