import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import type { Analytics } from '../../Analytics.ts';
import { cveExposureOk, embeddedReportData } from '../testFactories.ts';
import { automatedStoryCopy, automatedStoryTestIds } from './acts/AutomatedStory.tsx';
import { callToActionCopy, callToActionTestIds } from './acts/CallToAction.tsx';
import { costStoryCopy, costStoryTestIds } from './acts/CostStory.tsx';
import { methodologyAppendixTestIds } from './acts/MethodologyAppendix.tsx';
import { openPrAgeStoryCopy, openPrAgeStoryTestIds } from './acts/OpenPrAgeStory.tsx';
import { riskStoryCopy, riskStoryTestIds } from './acts/RiskStory.tsx';
import { verdictCopy, verdictTestIds } from './acts/Verdict.tsx';
import { AnalyticsProvider } from './analytics/AnalyticsContext.tsx';
import { App, appTestIds } from './App.tsx';
import { assumptionInputTestIds } from './primitives/AssumptionInput.tsx';
import { footnoteReferenceTestId } from './primitives/FootnoteReference.tsx';
import type { EmbeddedReportData } from './types.ts';

describe('App report shell', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders the headline annual cost from the embedded data', () => {
    renderReport();

    expect(screen.getByTestId(verdictTestIds.annualCost)).toHaveTextContent('50 engineer-hours/quarter');
    expect(screen.getByTestId(verdictTestIds.section)).toHaveTextContent(verdictCopy.costLeadIn);
    expect(screen.getByTestId(verdictTestIds.section)).toHaveTextContent(verdictCopy.costTrailer);
    // The headline clarifies it excludes the open backlog, which lives in its own section.
    expect(screen.getByTestId(verdictTestIds.section)).toHaveTextContent('not including the 102 still open');
    expect(screen.getByTestId(assumptionInputTestIds.container)).toBeInTheDocument();
    expect(screen.getByTestId(verdictTestIds.section)).not.toHaveTextContent('Showing savings as time');
    expect(screen.queryByTestId(assumptionInputTestIds.hourlyRateUsd)).not.toBeInTheDocument();
  });

  it('recalculates the headline cost and comparison cards when assumptions change', () => {
    renderReport();
    const assumptions = screen.getByTestId(assumptionInputTestIds.container);

    fireEvent.change(within(assumptions).getByTestId(assumptionInputTestIds.minutesPerPr), {
      target: { value: '12' },
    });

    expect(screen.getByTestId(verdictTestIds.annualCost)).toHaveTextContent('60 engineer-hours/quarter');
    expect(screen.getByTestId(costStoryTestIds.windowCost)).toHaveTextContent('60 hrs');
    expect(screen.getByTestId(costStoryTestIds.monthlyCost)).toHaveTextContent('20 hrs/mo');
    expect(screen.getByTestId(costStoryTestIds.annualCost)).toHaveTextContent('60 hrs/qtr');
    // The automation comparison defaults to recovered engineer hours per quarter.
    expect(screen.getByTestId(automatedStoryTestIds.todayCost)).toHaveTextContent('~60 hrs/qtr');
    expect(screen.getByTestId(automatedStoryTestIds.patchwaveCost)).toHaveTextContent('~36 hrs/qtr');
  });

  it('toggles report savings from time to cost', () => {
    renderReport();
    const assumptions = screen.getByTestId(assumptionInputTestIds.container);

    fireEvent.click(within(assumptions).getByTestId(assumptionInputTestIds.displayCost));

    expect(within(assumptions).getByTestId(assumptionInputTestIds.hourlyRateUsd)).toBeInTheDocument();
    expect(screen.getByTestId(verdictTestIds.section)).not.toHaveTextContent('Showing savings as cost');
    expect(screen.getByTestId(verdictTestIds.annualCost)).toHaveTextContent('~$40,560/year');
    expect(screen.getByTestId(costStoryTestIds.windowCost)).toHaveTextContent('$10,000');
    expect(screen.getByTestId(costStoryTestIds.monthlyCost)).toHaveTextContent('$3,380/mo');
    expect(screen.getByTestId(costStoryTestIds.annualCost)).toHaveTextContent('$40,560/yr');
    expect(screen.getByTestId(automatedStoryTestIds.todayCost)).toHaveTextContent('$40,560/yr');
    expect(screen.getByTestId(automatedStoryTestIds.patchwaveCost)).toHaveTextContent('$24,336/yr');

    const table = screen.getByTestId(costStoryTestIds.peopleTable);
    expect(within(table).getByRole('columnheader', { name: 'Cost over last 90 days' })).toBeInTheDocument();
    expect(within(table).getByText('alice').closest('tr')).toHaveTextContent('$6,400');
  });

  it('allows replacing an assumption value by clearing and typing', () => {
    renderReport();
    const assumptions = screen.getByTestId(assumptionInputTestIds.container);
    const minutesInput = within(assumptions).getByTestId(assumptionInputTestIds.minutesPerPr);

    fireEvent.focus(minutesInput);
    fireEvent.change(minutesInput, { target: { value: '' } });
    expect(minutesInput).toHaveValue('');

    fireEvent.change(minutesInput, { target: { value: '12' } });
    fireEvent.blur(minutesInput);

    expect(minutesInput).toHaveValue('12');
    expect(screen.getByTestId(verdictTestIds.annualCost)).toHaveTextContent('60 engineer-hours/quarter');
  });

  it('recalculates the PatchWave savings card when the auto-merge share changes', () => {
    renderReport();

    // Default 60% share matches PatchWave's public calculator assumption.
    expect(screen.getByTestId(automatedStoryTestIds.delta)).toHaveTextContent('60%');
    expect(screen.getByTestId(automatedStoryTestIds.patchwaveCost)).toHaveTextContent('~30 hrs/qtr');

    fireEvent.change(screen.getByTestId(automatedStoryTestIds.shareSlider), { target: { value: '50' } });

    expect(screen.getByTestId(automatedStoryTestIds.delta)).toHaveTextContent('50%');
    expect(screen.getByTestId(automatedStoryTestIds.patchwaveCost)).toHaveTextContent('~25 hrs/qtr');
  });

  it('lists footnotes in ascending first-appearance order', () => {
    renderReport();

    fireEvent.click(screen.getByText('How this report was calculated'));

    const sources = screen.getByTestId(methodologyAppendixTestIds.sources);
    // The solution section leads the report, so its Mohayeji citation is the first footnote.
    expect(sources).toHaveTextContent('1. Mohayeji et al. 2025');
    expect(sources).toHaveTextContent('2. VulnCheck, May 2026');
    expect(sources).toHaveTextContent('3. Anthropic, "Project Glasswing');
    expect(sources).toHaveTextContent('4. Anthropic, Coordinated Vulnerability Disclosure dashboard');
    expect(sources).toHaveTextContent('5. Atlassian State of Developer Experience Report 2025.');
  });

  it('opens the appendix source note instead of navigating directly when a citation is clicked', () => {
    renderReport();
    const details = screen.getByTestId(methodologyAppendixTestIds.section).querySelector('details');
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

    expect(screen.getByTestId(riskStoryTestIds.heading)).toHaveTextContent('7 open security alerts');
    expect(screen.getByTestId(riskStoryTestIds.severityBar)).toBeInTheDocument();
  });

  it('summarizes repos with security alerts disabled and links to the appendix table', () => {
    renderReport({ cve: cveExposureOk.build({ reposWithSecurityAlertsDisabled: ['acme/a', 'acme/b'] }) });

    const warning = screen.getByTestId(riskStoryTestIds.disabledAlertsWarning);
    expect(warning).toHaveTextContent(
      'Did you know: 2 of your 24 repos do not have Dependabot security alerts enabled',
    );

    const details = screen.getByTestId(methodologyAppendixTestIds.section).querySelector('details');
    expect(details).not.toHaveAttribute('open');

    const restore = suppressNavigation();
    fireEvent.click(within(warning).getByTestId(riskStoryTestIds.disabledAlertsLink));
    restore();

    // The link opens the collapsed appendix on the Calculation tab, where the repos render as a table.
    expect(details).toHaveAttribute('open');
    const table = screen.getByTestId(methodologyAppendixTestIds.disabledAlertsRepos);
    expect(table).toHaveTextContent('acme/a');
    expect(table).toHaveTextContent('acme/b');
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
    expect(within(table).getByText('repo-5')).toBeInTheDocument();
    expect(within(table).queryByText('repo-6')).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId(riskStoryTestIds.topReposToggle));

    expect(within(table).getByText('repo-6')).toBeInTheDocument();
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
    expect(screen.getByTestId(automatedStoryTestIds.secondaryCta)).toHaveTextContent(automatedStoryCopy.secondaryCta);
    expect(screen.getByTestId(automatedStoryTestIds.secondaryCta)).toHaveAttribute('data-variant', 'secondary');
    expect(
      screen
        .getByTestId(automatedStoryTestIds.waitlistCta)
        .compareDocumentPosition(screen.getByTestId(automatedStoryTestIds.secondaryCta)),
    ).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
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

  it('combines person merge and review rows and labels the cost window', () => {
    renderReport();

    const table = screen.getByTestId(costStoryTestIds.peopleTable);
    expect(within(table).getByRole('columnheader', { name: 'Time over last 90 days' })).toBeInTheDocument();
    const aliceCells = within(table).getAllByText('alice');
    expect(aliceCells).toHaveLength(1);
    // alice merged and reviewed, so her two activity rows collapse into one combined row.
    const aliceRow = aliceCells[0]?.closest('tr');
    expect(aliceRow).toHaveTextContent('180');
    expect(aliceRow).toHaveTextContent('merged');
    expect(aliceRow).toHaveTextContent('12');
    expect(aliceRow).toHaveTextContent('reviewed');
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

  it('reworks per-person review time when the minutes-per-PR assumption changes', () => {
    renderReport({
      people: {
        mergers: [],
        reviewers: [{ login: 'carol', count: 10, windowCostUsd: 0, annualCostUsd: 0 }],
        commenters: [],
      },
    });

    const table = screen.getByTestId(costStoryTestIds.peopleTable);
    // 10 reviews x 10 min / 60 = ~2 hours in window at the defaults.
    expect(within(table).getByText('carol').closest('tr')).toHaveTextContent('2');

    const assumptions = screen.getByTestId(assumptionInputTestIds.container);
    fireEvent.change(within(assumptions).getByTestId(assumptionInputTestIds.minutesPerPr), {
      target: { value: '20' },
    });

    // Reviews ride the same minutes-per-PR slider as merges, so editing it reworks the time:
    // 10 reviews x 20 min / 60 = ~3 hours.
    expect(within(table).getByText('carol').closest('tr')).toHaveTextContent('3');
  });

  it('keeps raw-data people rows count-only when an assumption changes', () => {
    renderReport({
      people: {
        mergers: [],
        reviewers: [{ login: 'carol', count: 10, windowCostUsd: 0, annualCostUsd: 0 }],
        commenters: [],
      },
    });

    // The assumptions control lives in the hero, so it stays editable regardless of the appendix tab.
    const assumptions = screen.getByTestId(assumptionInputTestIds.container);
    fireEvent.change(within(assumptions).getByTestId(assumptionInputTestIds.minutesPerPr), {
      target: { value: '20' },
    });

    fireEvent.click(screen.getByText('How this report was calculated'));
    fireEvent.click(screen.getByRole('tab', { name: 'Raw data' }));

    const rawData = screen.getByTestId(methodologyAppendixTestIds.rawData);
    const row = within(rawData).getByText('carol').closest('li');
    expect(row).toHaveTextContent('10 reviewed');
    expect(row).not.toHaveTextContent('$');
  });

  it('renders the open PR age buckets as a separate section with count-only rows', () => {
    renderReport();

    const section = screen.getByTestId(openPrAgeStoryTestIds.section);
    const breakdown = screen.getByTestId(openPrAgeStoryTestIds.breakdown);
    expect(section).toHaveTextContent(openPrAgeStoryCopy.heading);
    // Headline backlog stats summarize the section before the per-bucket bars.
    expect(section).toHaveTextContent('102');
    expect(section).toHaveTextContent('still open');
    expect(section).toHaveTextContent('74 days');
    expect(section).toHaveTextContent('average age');
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
        openAvgAgeDays: null,
        openAgeBuckets: [],
      },
    });

    const section = screen.getByTestId(openPrAgeStoryTestIds.section);
    expect(section).toHaveTextContent(openPrAgeStoryCopy.emptyHeading);
    expect(section).not.toHaveTextContent(openPrAgeStoryCopy.heading);
    expect(section).not.toHaveTextContent('Volume is trending up, not down');
    expect(section).not.toHaveTextContent('average age');
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

  it('captures cta_clicked when the automated story secondary CTA is clicked', () => {
    const { analytics, events } = createFakeAnalytics();
    renderWithAnalytics(analytics);

    const restore = suppressNavigation();
    fireEvent.click(screen.getByTestId(automatedStoryTestIds.secondaryCta));
    restore();

    expect(events).toContainEqual({ event: 'cta_clicked', properties: { which: 'automated_story_secondary' } });
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

    const input = screen.getAllByTestId(assumptionInputTestIds.minutesPerPr)[0];
    if (!input) throw new Error('missing minutes per PR input');
    fireEvent.change(input, { target: { value: '12' } });
    fireEvent.blur(input);

    expect(events).toContainEqual({
      event: 'assumption_changed',
      properties: { field: 'minutes_per_pr', value: 12 },
    });
  });
});
