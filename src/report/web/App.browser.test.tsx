import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import type { Analytics } from '../../Analytics.ts';
import { embeddedReportData } from '../testFactories.ts';
import { callToActionCopy, callToActionTestIds } from './acts/CallToAction.tsx';
import { costStoryCopy, costStoryTestIds } from './acts/CostStory.tsx';
import { riskStoryCopy, riskStoryTestIds } from './acts/RiskStory.tsx';
import { verdictCopy, verdictTestIds } from './acts/Verdict.tsx';
import { AnalyticsProvider } from './analytics/AnalyticsContext.tsx';
import { App, appTestIds } from './App.tsx';
import { assumptionInputTestIds } from './primitives/AssumptionInput.tsx';
import type { EmbeddedReportData } from './types.ts';

describe('App report shell', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders the headline annual cost from the embedded data', () => {
    renderReport();

    expect(screen.getByTestId(verdictTestIds.annualCost)).toHaveTextContent('$13,836/year');
    expect(screen.getByTestId(verdictTestIds.section)).toHaveTextContent(verdictCopy.costDescription);
  });

  it('recalculates costs and savings when assumptions change', () => {
    renderReport();
    const firstAssumptions = screen.getAllByTestId(assumptionInputTestIds.container)[0];
    if (!firstAssumptions) throw new Error('missing assumptions form');

    fireEvent.change(within(firstAssumptions).getByTestId(assumptionInputTestIds.hourlyRate), {
      target: { value: '300' },
    });

    expect(screen.getByTestId(verdictTestIds.annualCost)).toHaveTextContent('$27,684/year');
    expect(screen.getByTestId(costStoryTestIds.annualCost)).toHaveTextContent('$27,684/yr');
    expect(screen.getByText('$22,152')).toBeInTheDocument();
  });

  it('renders the ok CVE state with severity counts', () => {
    renderReport();

    expect(screen.getByTestId(verdictTestIds.cveLine)).toHaveTextContent('7 open security alerts');
    expect(screen.getByTestId(riskStoryTestIds.heading)).toHaveTextContent(
      "7 open alerts, and how long they've been sitting",
    );
    expect(screen.getByTestId(riskStoryTestIds.severityBar)).toBeInTheDocument();
  });

  it('renders the scope-missing CVE state', () => {
    renderReport({
      cve: {
        status: 'scope-missing',
        requiredScope: 'security_events',
        totalOpenAlerts: 0,
        bySeverity: { critical: 0, high: 0, medium: 0, low: 0 },
        topReposBySeverity: [],
        oldestCriticalDays: null,
        oldestHighDays: null,
        reposWithSecurityAlertsDisabled: [],
      },
    });

    expect(screen.getByTestId(verdictTestIds.cveLine)).toHaveTextContent(verdictCopy.cveScopeMissing);
    expect(screen.getByTestId(riskStoryTestIds.heading)).toHaveTextContent(riskStoryCopy.scopeMissingHeading);
    expect(screen.getByTestId(riskStoryTestIds.scopeRefreshCommand)).toHaveTextContent(
      'gh auth refresh -s security_events',
    );
  });

  it('renders the no-data CVE state', () => {
    renderReport({
      cve: {
        status: 'no-data',
        totalOpenAlerts: 0,
        bySeverity: { critical: 0, high: 0, medium: 0, low: 0 },
        topReposBySeverity: [],
        oldestCriticalDays: null,
        oldestHighDays: null,
        reposWithSecurityAlertsDisabled: [],
      },
    });

    expect(screen.getByTestId(verdictTestIds.cveLine)).toHaveTextContent(verdictCopy.cveNoData);
    expect(screen.getByTestId(riskStoryTestIds.heading)).toHaveTextContent(riskStoryCopy.noAlertsHeading);
  });

  it('renders the primary sections and CTAs', () => {
    renderReport();

    expect(screen.getByTestId(appTestIds.header)).toBeInTheDocument();
    expect(screen.getByTestId(costStoryTestIds.section)).toHaveTextContent(costStoryCopy.heading);
    expect(screen.getByTestId(riskStoryTestIds.section)).toHaveTextContent(riskStoryCopy.eyebrow);
    expect(screen.getByTestId(callToActionTestIds.section)).toHaveTextContent(callToActionCopy.heading);
    expect(screen.getByTestId(verdictTestIds.primaryCta)).toHaveTextContent(verdictCopy.primaryCta);
    expect(screen.getByTestId(callToActionTestIds.link)).toHaveTextContent(callToActionCopy.linkLabel);
  });
});

function renderReport(overrides: Partial<EmbeddedReportData> = {}) {
  render(<App data={{ ...embeddedReportData.build(), ...overrides }} />);
}

interface RecordedEvent {
  event: string;
  properties?: Record<string, unknown>;
}

function createFakeAnalytics() {
  const events: RecordedEvent[] = [];
  const analytics: Analytics = {
    identify: () => {},
    capture: (event, properties) => {
      events.push({ event, properties });
    },
    register: () => {},
    flush: () => Promise.resolve(),
    shutdown: () => Promise.resolve(),
  };
  return { analytics, events };
}

function renderWithAnalytics(analytics: Analytics) {
  render(
    <AnalyticsProvider value={analytics}>
      <App data={embeddedReportData.build()} />
    </AnalyticsProvider>,
  );
}

// Clicking a real <a href> would navigate the test page away. Cancel the default in the capture
// phase so React's onClick still fires (preventDefault doesn't stop propagation).
function suppressNavigation(): () => void {
  const handler = (e: Event) => e.preventDefault();
  document.addEventListener('click', handler, true);
  return () => document.removeEventListener('click', handler, true);
}

describe('App analytics', () => {
  afterEach(() => {
    cleanup();
  });

  it('captures cta_clicked when the verdict primary CTA is clicked', () => {
    const { analytics, events } = createFakeAnalytics();
    renderWithAnalytics(analytics);

    const restore = suppressNavigation();
    fireEvent.click(screen.getByTestId(verdictTestIds.primaryCta));
    restore();

    expect(events).toContainEqual({ event: 'cta_clicked', properties: { which: 'verdict_primary' } });
  });

  it('captures cta_clicked when the call-to-action link is clicked', () => {
    const { analytics, events } = createFakeAnalytics();
    renderWithAnalytics(analytics);

    const restore = suppressNavigation();
    fireEvent.click(screen.getByTestId(callToActionTestIds.link));
    restore();

    expect(events).toContainEqual({ event: 'cta_clicked', properties: { which: 'call_to_action' } });
  });

  it('captures assumption_changed when an assumption input is committed', () => {
    const { analytics, events } = createFakeAnalytics();
    renderWithAnalytics(analytics);

    const input = screen.getAllByTestId(assumptionInputTestIds.hourlyRate)[0];
    if (!input) throw new Error('missing hourly rate input');
    fireEvent.change(input, { target: { value: '275' } });
    fireEvent.blur(input);

    expect(events).toContainEqual({
      event: 'assumption_changed',
      properties: { field: 'hourly_rate', value: 275 },
    });
  });
});
