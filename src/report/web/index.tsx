import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { POSTHOG_HOST, POSTHOG_KEY } from '../../buildInfo.ts';
import { AnalyticsProvider } from './analytics/AnalyticsContext.tsx';
import { createReportAnalytics } from './analytics/index.ts';
import { App } from './App.tsx';
import { readEmbeddedAnalytics } from './data/readEmbeddedAnalytics.ts';
import { readEmbeddedData } from './data/readEmbeddedData.ts';
import './styles.css';

const data = readEmbeddedData();
const analyticsConfig = readEmbeddedAnalytics();
const analytics = createReportAnalytics({
  config: analyticsConfig,
  buildInfo: {
    postHogKey: POSTHOG_KEY,
    postHogHost: POSTHOG_HOST,
    version: analyticsConfig.version,
  },
});
analytics.capture('report_opened');

const container = document.getElementById('root');
if (!container) {
  throw new Error('missing #root element');
}
createRoot(container).render(
  <StrictMode>
    <AnalyticsProvider value={analytics}>
      <App data={data} />
    </AnalyticsProvider>
  </StrictMode>,
);
