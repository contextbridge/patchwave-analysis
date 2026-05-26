import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import type { Analytics } from '../../Analytics.ts';
import { cveExposureOk, embeddedReportData } from '../testFactories.ts';
import { automatedStoryTestIds } from './acts/AutomatedStory.tsx';
import { callToActionCopy, callToActionTestIds } from './acts/CallToAction.tsx';
import { costStoryCopy, costStoryTestIds } from './acts/CostStory.tsx';
import { methodologyAppendixTestIds } from './acts/MethodologyAppendix.tsx';
import { openPrAgeStoryCopy, openPrAgeStoryTestIds } from './acts/OpenPrAgeStory.tsx';
import { riskStoryCopy, riskStoryTestIds } from './acts/RiskStory.tsx';
import { verdictCopy, verdictTestIds } from './acts/Verdict.tsx';
import { AnalyticsProvider } from './analytics/AnalyticsContext.tsx';
import { App, appTestIds } from './App.tsx';
import { assumptionInputTestIds } from './primitives/AssumptionInput.tsx';
import { assumptionsFootnoteTestId } from './primitives/AssumptionsFootnote.tsx';
import { footnoteReferenceTestId } from './primitives/FootnoteReference.tsx';
import type { EmbeddedReportData } from './types.ts';

describe('App report shell', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders the headline annual cost from the embedded data', () => {
    renderReport();

    expect(screen.getByTestId(verdictTestIds.annualCost)).toHaveTextContent('$8,208/year');
    expect(screen.getByTestId(verdictTestIds.section)).toHaveTextContent(verdictCopy.costLeadIn);
    expect(screen.getByTestId(verdictTestIds.section)).toHaveTextContent(verdictCopy.costTrailer);
  });

  it('recalculates the headline cost and comparison cards when assumptions change', () => {
    renderReport();
    const assumptions = screen.getByTestId(assumptionInputTestIds.container);

    fireEvent.change(within(assumptions).getByTestId(assumptionInputTestIds.hourlyRate), {
      target: { value: '300' },
    });

    expect(screen.getByTestId(verdictTestIds.annualCost)).toHaveTextContent('$16,428/year');
    expect(screen.getByTestId(costStoryTestIds.annualCost)).toHaveTextContent('$16,428/yr');
    // "Today" mirrors the headline; "PatchWave savings" is the recovered cost at the default 65% share.
    expect(screen.getByTestId(automatedStoryTestIds.todayCost)).toHaveTextContent('$16,428/yr');
    expect(screen.getByTestId(automatedStoryTestIds.patchwaveCost)).toHaveTextContent('$10,678/yr');
  });

  it('allows replacing an assumption value by clearing and typing', () => {
    renderReport();
    const assumptions = screen.getByTestId(assumptionInputTestIds.container);
    const hourlyRateInput = within(assumptions).getByTestId(assumptionInputTestIds.hourlyRate);

    fireEvent.focus(hourlyRateInput);
    fireEvent.change(hourlyRateInput, { target: { value: '' } });
    expect(hourlyRateInput).toHaveValue('');

    fireEvent.change(hourlyRateInput, { target: { value: '275' } });
    fireEvent.blur(hourlyRateInput);

    expect(hourlyRateInput).toHaveValue('275');
    expect(screen.getByTestId(verdictTestIds.annualCost)).toHaveTextContent('~$15,060/year');
  });

  it('recalculates the PatchWave savings card when the auto-merge share changes', () => {
    renderReport();

    // Default 65% share starts in the middle of the modeled range.
    expect(screen.getByTestId(automatedStoryTestIds.delta)).toHaveTextContent('65%');
    expect(screen.getByTestId(automatedStoryTestIds.patchwaveCost)).toHaveTextContent('$5,335/yr');

    fireEvent.change(screen.getByTestId(automatedStoryTestIds.shareSlider), { target: { value: '50' } });

    expect(screen.getByTestId(automatedStoryTestIds.delta)).toHaveTextContent('50%');
    expect(screen.getByTestId(automatedStoryTestIds.patchwaveCost)).toHaveTextContent('$4,104/yr');
  });

  it('reveals the methodology assumptions panel when an estimate footnote is clicked', () => {
    renderReport();
    const details = screen.getByTestId(assumptionInputTestIds.container).closest('details');
    expect(details).toBeTruthy();
    expect(details).not.toHaveAttribute('open');

    const footnote = screen.getAllByTestId(assumptionsFootnoteTestId)[0];
    if (!footnote) throw new Error('missing assumptions footnote');
    const restore = suppressNavigation();
    fireEvent.click(footnote);
    restore();

    expect(details).toHaveAttribute('open');
  });

  it('switches back to the calculation tab when an assumptions footnote is clicked from raw data', () => {
    renderReport();
    fireEvent.click(screen.getByText('How this report was calculated'));
    fireEvent.click(screen.getByRole('tab', { name: 'Raw data' }));
    expect(screen.queryByTestId(assumptionInputTestIds.container)).not.toBeInTheDocument();

    const restore = suppressNavigation();
    fireEvent.click(screen.getAllByTestId(assumptionsFootnoteTestId)[0] as HTMLElement);
    restore();

    expect(screen.getByRole('tab', { name: 'Calculation' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByTestId(assumptionInputTestIds.container)).toBeInTheDocument();
  });

  it('lists footnotes in ascending first-appearance order', () => {
    renderReport();

    fireEvent.click(screen.getByText('How this report was calculated'));

    const sources = screen.getByTestId(methodologyAppendixTestIds.sources);
    expect(sources).toHaveTextContent('1. Adjustable cost assumptions.');
    expect(sources).toHaveTextContent('2. VulnCheck, May 2026');
    expect(sources).toHaveTextContent('3. Anthropic, "Project Glasswing');
    expect(sources).toHaveTextContent('4. Anthropic, Coordinated Vulnerability Disclosure dashboard');
    expect(sources).toHaveTextContent('5. Mohayeji et al. 2025');
    expect(sources).toHaveTextContent('6. Atlassian State of Developer Experience Report 2025.');
  });

  it('opens the appendix source note instead of navigating directly when a citation is clicked', () => {
    renderReport();
    const details = screen.getByTestId(assumptionInputTestIds.container).closest('details');
    expect(details).toBeTruthy();
    expect(details).not.toHaveAttribute('open');

    const restore = suppressNavigation();
    fireEvent.click(screen.getAllByTestId(footnoteReferenceTestId)[0] as HTMLElement);
    restore();

    expect(details).toHaveAttribute('open');
    expect(screen.getByTestId(methodologyAppendixTestIds.sources)).toHaveTextContent('VulnCheck, May 2026');
    expect(
      screen.getByRole('link', { name: 'https://www.vulncheck.com/blog/ai-assisted-vulnerability-discovery' }),
    ).toBeInTheDocument();
  });

  it('renders the ok CVE state with severity counts', () => {
    renderReport();

    expect(screen.getByTestId(verdictTestIds.cveLine)).toHaveTextContent('7 open security alerts');
    expect(screen.getByTestId(riskStoryTestIds.heading)).toHaveTextContent('7 open security alerts');
    expect(screen.getByTestId(riskStoryTestIds.severityBar)).toBeInTheDocument();
  });

  it('summarizes repos with security alerts disabled and lists them in the source note', () => {
    renderReport({ cve: cveExposureOk.build({ reposWithSecurityAlertsDisabled: ['acme/a', 'acme/b'] }) });

    const warning = screen.getByTestId(riskStoryTestIds.disabledAlertsWarning);
    expect(warning).toHaveTextContent(
      'Did you know: 2 of your 24 repos do not have Dependabot security alerts enabled',
    );
    expect(warning).not.toHaveTextContent('*');

    const restore = suppressNavigation();
    fireEvent.click(within(warning).getByTestId(footnoteReferenceTestId));
    restore();

    const sources = screen.getByTestId(methodologyAppendixTestIds.sources);
    expect(sources).toHaveTextContent('Repos without security alerts enabled');
    expect(sources).toHaveTextContent('acme/a, acme/b');
  });

  it('limits the top repos by severity table to the top five with an optional expansion', () => {
    renderReport({
      cve: cveExposureOk.build({
        topReposBySeverity: Array.from({ length: 6 }, (_, i) => ({
          repo: `acme/repo-${i + 1}`,
          critical: i === 0 ? 1 : 0,
          high: Math.max(0, 6 - i),
          medium: i,
          low: 0,
        })),
      }),
    });

    const table = screen.getByTestId(riskStoryTestIds.topReposTable);
    expect(within(table).getByText('acme/repo-5')).toBeInTheDocument();
    expect(within(table).queryByText('acme/repo-6')).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId(riskStoryTestIds.topReposToggle));

    expect(within(table).getByText('acme/repo-6')).toBeInTheDocument();
    expect(screen.getByTestId(riskStoryTestIds.topReposToggle)).toHaveTextContent('Show top 5');
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

  it('renders the primary sections and CTAs', () => {
    renderReport();

    expect(screen.getByTestId(appTestIds.header)).toBeInTheDocument();
    expect(screen.getByTestId(appTestIds.headerContext)).toHaveTextContent('Analysis for acme');
    expect(screen.getByTestId(verdictTestIds.section)).not.toHaveTextContent('PatchWave Analysis');
    expect(screen.getByTestId(costStoryTestIds.section)).toHaveTextContent(costStoryCopy.heading);
    expect(screen.getByTestId(openPrAgeStoryTestIds.section)).toHaveTextContent(openPrAgeStoryCopy.heading);
    expect(screen.getByTestId(riskStoryTestIds.section)).toHaveTextContent(riskStoryCopy.eyebrow);
    expect(screen.getByTestId(callToActionTestIds.section)).toHaveTextContent(callToActionCopy.heading);
    expect(screen.getByTestId(verdictTestIds.section)).toHaveTextContent('based on adjustable1 assumptions');
    expect(screen.getByTestId(automatedStoryTestIds.todayCost).parentElement).toHaveTextContent('Adjustable1 estimate');
    expect(screen.getByTestId(verdictTestIds.primaryCta)).toHaveTextContent(verdictCopy.primaryCta);
    expect(screen.getByTestId(verdictTestIds.primaryCta)).toHaveAttribute('data-variant', 'default');
    expect(screen.getByTestId(callToActionTestIds.cta)).toHaveTextContent(callToActionCopy.ctaLabel);

    fireEvent.click(screen.getByText('How this report was calculated'));
    expect(screen.getByTestId(methodologyAppendixTestIds.tabList)).toBeInTheDocument();
    expect(screen.getByTestId(methodologyAppendixTestIds.sources)).toHaveTextContent('Sources and notes');
    expect(screen.getByRole('link', { name: 'patchwave-analysis' })).toHaveAttribute(
      'href',
      'https://github.com/contextbridge/patchwave-analysis',
    );
    expect(screen.getByRole('link', { name: 'ContextBridge' })).toHaveAttribute('href', 'https://contextbridge.ai');
    expect(screen.getByTestId(methodologyAppendixTestIds.section)).not.toHaveTextContent('patchwave.ai');
  });

  it('places every assumptions footnote immediately after adjustable', () => {
    renderReport();
    fireEvent.click(screen.getByText('How this report was calculated'));

    for (const footnote of screen.getAllByTestId(assumptionsFootnoteTestId)) {
      const previousText = footnote.previousSibling?.textContent ?? '';
      expect(previousText.trimEnd().toLowerCase().endsWith('adjustable')).toBe(true);
    }
  });

  it('combines person merge and review rows and labels the cost window', () => {
    renderReport();

    const table = screen.getByTestId(costStoryTestIds.peopleTable);
    expect(within(table).getByRole('columnheader', { name: 'Cost over last 90 days' })).toBeInTheDocument();
    expect(within(table).getAllByText('alice')).toHaveLength(1);
    expect(within(table).getByText('90')).toBeInTheDocument();
    expect(within(table).getAllByText('merged').length).toBeGreaterThan(0);
    expect(within(table).getByText('12')).toBeInTheDocument();
    expect(within(table).getByText('reviewed')).toBeInTheDocument();
  });

  it('limits the people table to the top five with an optional expansion', () => {
    renderReport({
      people: {
        mergers: Array.from({ length: 6 }, (_, i) => ({
          login: `person-${i + 1}`,
          count: 10 - i,
          windowCostUsd: 100 - i,
          annualCostUsd: 1000 - i,
        })),
        reviewers: [],
        commenters: [],
      },
    });

    const table = screen.getByTestId(costStoryTestIds.peopleTable);
    expect(within(table).getByText('person-5')).toBeInTheDocument();
    expect(within(table).queryByText('person-6')).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId(costStoryTestIds.peopleToggle));

    expect(within(table).getByText('person-6')).toBeInTheDocument();
  });

  it('reworks per-person review costs when the minutes-per-PR assumption changes', () => {
    renderReport({
      people: {
        mergers: [],
        reviewers: [{ login: 'carol', count: 10, windowCostUsd: 0, annualCostUsd: 0 }],
        commenters: [],
      },
    });

    const table = screen.getByTestId(costStoryTestIds.peopleTable);
    // 10 reviews x 5 min x $150/hr / 60 = $125 in window at the defaults.
    expect(within(table).getByText('carol').closest('tr')).toHaveTextContent('$125');

    const assumptions = screen.getByTestId(assumptionInputTestIds.container);
    fireEvent.change(within(assumptions).getByTestId(assumptionInputTestIds.minutesPerPr), {
      target: { value: '10' },
    });

    // Reviews ride the same minutes-per-PR slider as merges, so doubling it doubles the cost.
    expect(within(table).getByText('carol').closest('tr')).toHaveTextContent('$250');
  });

  it('reworks the raw-data per-person costs when an assumption changes', () => {
    renderReport({
      people: {
        mergers: [],
        reviewers: [{ login: 'carol', count: 10, windowCostUsd: 0, annualCostUsd: 0 }],
        commenters: [],
      },
    });

    // The input lives on the Calculation tab and unmounts on Raw data, so adjust before navigating.
    const assumptions = screen.getByTestId(assumptionInputTestIds.container);
    fireEvent.change(within(assumptions).getByTestId(assumptionInputTestIds.minutesPerPr), {
      target: { value: '10' },
    });

    fireEvent.click(screen.getByText('How this report was calculated'));
    fireEvent.click(screen.getByRole('tab', { name: 'Raw data' }));

    // 10 reviews x 10 min x $150/hr / 60 = $250 window, annualized to $1,014/yr.
    const rawData = screen.getByTestId(methodologyAppendixTestIds.rawData);
    expect(within(rawData).getByText('carol').closest('li')).toHaveTextContent('$1,014/yr');
  });

  it('renders the open PR age buckets as a separate section with count-only rows', () => {
    renderReport();

    const section = screen.getByTestId(openPrAgeStoryTestIds.section);
    const breakdown = screen.getByTestId(openPrAgeStoryTestIds.breakdown);
    expect(section).toHaveTextContent(openPrAgeStoryCopy.heading);
    expect(breakdown).toHaveTextContent('0–30 days');
    expect(breakdown).toHaveTextContent('40');
    expect(breakdown).toHaveTextContent('Time-to-merge in your data: p50 2d, p90 14d');
    expect(breakdown).not.toHaveTextContent('38 open Dependabot PRs are more than 90 days old');
    expect(breakdown).not.toHaveTextContent('39%');
  });

  it('uses neutral open PR copy when there is no backlog', () => {
    renderReport({
      prBacklog: {
        ...embeddedReportData.build().prBacklog,
        openCount: 0,
        oldestOpenDays: null,
        openAgeBuckets: [],
      },
    });

    const section = screen.getByTestId(openPrAgeStoryTestIds.section);
    expect(section).toHaveTextContent(openPrAgeStoryCopy.emptyHeading);
    expect(section).not.toHaveTextContent(openPrAgeStoryCopy.heading);
    expect(section).not.toHaveTextContent('Volume is trending up, not down');
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

  it('captures cta_clicked when the call-to-action CTA is clicked', () => {
    const { analytics, events } = createFakeAnalytics();
    renderWithAnalytics(analytics);

    const restore = suppressNavigation();
    fireEvent.click(screen.getByTestId(callToActionTestIds.cta));
    restore();

    expect(events).toContainEqual({ event: 'cta_clicked', properties: { which: 'call_to_action_primary' } });
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
