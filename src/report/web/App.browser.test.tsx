import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { FakeAnalytics } from '../../testHelpers/FakeAnalytics.ts';
import {
  cveExposureOk,
  cveExposureScopeMissing,
  embeddedReportData,
  people,
  personActivity,
  prBacklog,
} from '../testFactories.ts';
import { automatedStoryTestIds } from './acts/AutomatedStory.tsx';
import { callToActionCopy, callToActionTestIds } from './acts/CallToAction.tsx';
import { costStoryCopy, costStoryTestIds } from './acts/CostStory.tsx';
import { methodologyAppendixTestIds } from './acts/MethodologyAppendix.tsx';
import { openPrAgeStoryCopy, openPrAgeStoryTestIds } from './acts/OpenPrAgeStory.tsx';
import { riskStoryCopy, riskStoryTestIds } from './acts/RiskStory.tsx';
import { verdictCopy, verdictTestIds } from './acts/Verdict.tsx';
import { AnalyticsProvider } from './analytics/AnalyticsContext.tsx';
import { App, appTestIds } from './App.tsx';
import type { DisplayUnit } from './hooks/useDisplayUnit.tsx';
import { costReceiptCopy, costReceiptTestIds } from './primitives/CostReceipt.tsx';
import { footnoteReferenceTestId } from './primitives/FootnoteReference.tsx';
import type { EmbeddedReportData } from './types.ts';

afterEach(() => {
  cleanup();
});

describe('report header', () => {
  it('names the org the report covers', () => {
    renderReport();

    expect(screen.getByTestId(appTestIds.headerContext)).toHaveTextContent('Analysis for acme');
  });

  it('defaults to hours and hides the hourly-rate factor', () => {
    renderReport();

    expect(screen.getByTestId(appTestIds.unitHours)).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByTestId(verdictTestIds.section)).toHaveTextContent(verdictCopy.costLeadIn('hours'));
    expect(screen.queryByTestId(costReceiptTestIds.rate)).toBeNull();
  });

  it('reveals the hourly-rate factor once dollars is selected', () => {
    renderReport({ unit: 'usd' });

    expect(screen.getByTestId(appTestIds.unitUsd)).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByTestId(costReceiptTestIds.rate)).toBeInTheDocument();
  });

  it('flips the unit with arrow keys and moves focus to the active radio', () => {
    renderReport();

    fireEvent.keyDown(screen.getByTestId(appTestIds.unitHours), { key: 'ArrowRight' });

    expect(screen.getByTestId(appTestIds.unitUsd)).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByTestId(appTestIds.unitUsd)).toHaveFocus();
  });
});

describe('cost headline', () => {
  it('reads as one equation from observed PRs through the editable assumptions', () => {
    renderReport({ unit: 'usd' });

    const receipt = screen.getByTestId(costReceiptTestIds.container);
    expect(within(receipt).getByTestId(costReceiptTestIds.observed)).toHaveTextContent('162');
    expect(within(receipt).getByTestId(costReceiptTestIds.observed)).toHaveTextContent(costReceiptCopy.observedBadge);
    expect(within(receipt).getByTestId(costReceiptTestIds.minutes)).toHaveValue('12');
    expect(within(receipt).getByTestId(costReceiptTestIds.rate)).toHaveValue('200');
    expect(within(receipt).getByTestId(costReceiptTestIds.annualize)).toHaveTextContent('4.06');
    expect(receipt).toHaveTextContent('365 ÷ 90 days');
  });

  it.each([
    { unit: 'hours', leadIn: verdictCopy.costLeadIn('hours'), headline: '~131 hrs/year' },
    { unit: 'usd', leadIn: verdictCopy.costLeadIn('usd'), headline: '~$26,280/year' },
  ] as const)('frames the headline as $unit', ({ unit, leadIn, headline }) => {
    renderReport({ unit });

    expect(screen.getByTestId(verdictTestIds.section)).toHaveTextContent(`${leadIn} ${verdictCopy.costTrailer}`);
    expect(screen.getByTestId(verdictTestIds.annualCost)).toHaveTextContent(headline);
  });

  it('notes that the headline excludes the open backlog', () => {
    renderReport();

    expect(screen.getByTestId(verdictTestIds.section)).toHaveTextContent(
      'Does not include the 102 Dependabot PRs that are still open',
    );
  });

  it('edits the assumptions inline, with no separate adjust control', () => {
    renderReport({ unit: 'usd' });

    const section = screen.getByTestId(verdictTestIds.section);
    expect(within(section).queryByText(/adjust/i)).toBeNull();
    expect(within(section).getByTestId(costReceiptTestIds.minutes)).toBeInTheDocument();
    expect(within(section).getByTestId(costReceiptTestIds.rate)).toBeInTheDocument();
  });

  it('ripples a rate change through the headline and every comparison card', () => {
    renderReport({ unit: 'usd' });
    const receipt = screen.getByTestId(costReceiptTestIds.container);

    fireEvent.change(within(receipt).getByTestId(costReceiptTestIds.rate), { target: { value: '300' } });

    expect(within(receipt).getByTestId(costReceiptTestIds.rate)).toHaveValue('300');
    expect(screen.getByTestId(verdictTestIds.annualCost)).toHaveTextContent('$39,420/year');
    expect(screen.getByTestId(costStoryTestIds.annualCost)).toHaveTextContent('$39,420/yr');
    expect(screen.getByTestId(automatedStoryTestIds.todayCost)).toHaveTextContent('$39,420/yr');
    // PatchWave savings at the default 65% share: auto-merged ($25,623) plus half the
    // review time on the remaining 35% ($6,899) = $32,522.
    expect(screen.getByTestId(automatedStoryTestIds.patchwaveCost)).toHaveTextContent('$32,522/yr');
  });

  it.each([
    { unit: 'hours', headline: '~263 hrs/year' },
    { unit: 'usd', headline: '~$52,560/year' },
  ] as const)('recalculates the $unit headline when minutes-per-PR doubles to 24', ({ unit, headline }) => {
    renderReport({ unit });
    const receipt = screen.getByTestId(costReceiptTestIds.container);

    fireEvent.change(within(receipt).getByTestId(costReceiptTestIds.minutes), { target: { value: '24' } });

    expect(screen.getByTestId(verdictTestIds.annualCost)).toHaveTextContent(headline);
  });

  it('replaces a rate by clearing the field and typing a new value', () => {
    renderReport({ unit: 'usd' });
    const rate = within(screen.getByTestId(costReceiptTestIds.container)).getByTestId(costReceiptTestIds.rate);

    fireEvent.focus(rate);
    fireEvent.change(rate, { target: { value: '' } });
    expect(rate).toHaveValue('');

    fireEvent.change(rate, { target: { value: '275' } });
    fireEvent.blur(rate);

    expect(rate).toHaveValue('275');
    expect(screen.getByTestId(verdictTestIds.annualCost)).toHaveTextContent('~$36,132/year');
  });
});

describe('cost breakdown', () => {
  it.each([
    { unit: 'hours', window: '32 hrs', monthly: '11 hrs/mo', annual: '131 hrs/yr' },
    { unit: 'usd', window: '$6,480', monthly: '$2,190/mo', annual: '$26,280/yr' },
  ] as const)('shows the window, monthly, and annual cells in $unit', ({ unit, window: w, monthly, annual }) => {
    renderReport({ unit });

    expect(screen.getByTestId(costStoryTestIds.windowCost)).toHaveTextContent(w);
    expect(screen.getByTestId(costStoryTestIds.monthlyCost)).toHaveTextContent(monthly);
    expect(screen.getByTestId(costStoryTestIds.annualCost)).toHaveTextContent(annual);
  });

  it('collapses a person who both merged and reviewed into a single row', () => {
    renderReport();

    // getByTestId throws on duplicates, so resolving a single row proves the merge/review collapse.
    const aliceRow = screen.getByTestId(`${costStoryTestIds.peopleRow}-alice`);
    expect(aliceRow).toHaveTextContent('90');
    expect(aliceRow).toHaveTextContent('merged');
    expect(aliceRow).toHaveTextContent('12');
    expect(aliceRow).toHaveTextContent('reviewed');
  });

  it.each([
    { unit: 'hours', header: 'Time over last 90 days', window: '20 hrs', annual: '83 hrs' },
    { unit: 'usd', header: 'Cost over last 90 days', window: '$4,080', annual: '$16,547' },
  ] as const)('labels the people table and values a person in $unit', ({ unit, header, window: w, annual }) => {
    renderReport({ unit });

    expect(screen.getByTestId(costStoryTestIds.peopleValueHeader)).toHaveTextContent(header);

    const aliceRow = screen.getByTestId(`${costStoryTestIds.peopleRow}-alice`);
    expect(aliceRow).toHaveTextContent(w);
    expect(aliceRow).toHaveTextContent(annual);
  });

  it('limits the people table to the top five with an optional expansion', () => {
    const mergers = Array.from({ length: 6 }, (_, i) => personActivity.build({ login: `person-${i + 1}` }));
    renderReport({ people: people.build({ mergers, reviewers: [], commenters: [] }) });

    expect(screen.getByTestId(`${costStoryTestIds.peopleRow}-person-5`)).toBeInTheDocument();
    expect(screen.queryByTestId(`${costStoryTestIds.peopleRow}-person-6`)).toBeNull();

    fireEvent.click(screen.getByTestId(costStoryTestIds.peopleToggle));

    expect(screen.getByTestId(`${costStoryTestIds.peopleRow}-person-6`)).toBeInTheDocument();
  });

  it('recomputes a person cost when the minutes-per-PR assumption changes', () => {
    const reviewers = [personActivity.build({ login: 'carol', count: 10 })];
    renderReport({ unit: 'usd', people: people.build({ mergers: [], reviewers, commenters: [] }) });

    // 10 reviews x 12 min x $200/hr / 60 = $400 at the defaults.
    expect(screen.getByTestId(`${costStoryTestIds.peopleRow}-carol`)).toHaveTextContent('$400');

    const receipt = screen.getByTestId(costReceiptTestIds.container);
    fireEvent.change(within(receipt).getByTestId(costReceiptTestIds.minutes), { target: { value: '10' } });

    // 10 reviews x 10 min x $200/hr / 60 = $333.
    expect(screen.getByTestId(`${costStoryTestIds.peopleRow}-carol`)).toHaveTextContent('$333');
  });

  it('falls back to an empty-state note when nobody merged or reviewed by hand', () => {
    renderReport({ people: people.build({ mergers: [], reviewers: [], commenters: [] }) });

    expect(screen.queryByTestId(costStoryTestIds.peopleTable)).toBeNull();
    expect(screen.getByTestId(costStoryTestIds.section)).toHaveTextContent(/No human merge or review activity/);
  });
});

describe('automation savings', () => {
  it.each([
    {
      unit: 'hours',
      today: '131 hrs/yr',
      savings: '108 hrs/yr',
      breakdown: '85 hrs auto-merged + 23 hrs accelerated reviews',
    },
    {
      unit: 'usd',
      today: '$26,280/yr',
      savings: '$21,681/yr',
      breakdown: '$17,082 auto-merged + $4,599 accelerated reviews',
    },
  ] as const)(
    'compares today against PatchWave in $unit at the default share',
    ({ unit, today, savings, breakdown }) => {
      renderReport({ unit });

      expect(screen.getByTestId(automatedStoryTestIds.delta)).toHaveTextContent('65%');
      expect(screen.getByTestId(automatedStoryTestIds.todayCost)).toHaveTextContent(today);
      expect(screen.getByTestId(automatedStoryTestIds.patchwaveCost)).toHaveTextContent(savings);
      expect(screen.getByTestId(automatedStoryTestIds.savingsBreakdown)).toHaveTextContent(breakdown);
    },
  );

  it.each([
    { unit: 'hours', savings: '99 hrs/yr', breakdown: '66 hrs auto-merged + 33 hrs accelerated reviews' },
    { unit: 'usd', savings: '$19,710/yr', breakdown: '$13,140 auto-merged + $6,570 accelerated reviews' },
  ] as const)('rescales the $unit savings when the auto-merge share drops to 50%', ({ unit, savings, breakdown }) => {
    renderReport({ unit });

    fireEvent.change(screen.getByTestId(automatedStoryTestIds.shareSlider), { target: { value: '50' } });

    expect(screen.getByTestId(automatedStoryTestIds.delta)).toHaveTextContent('50%');
    expect(screen.getByTestId(automatedStoryTestIds.patchwaveCost)).toHaveTextContent(savings);
    expect(screen.getByTestId(automatedStoryTestIds.savingsBreakdown)).toHaveTextContent(breakdown);
  });
});

describe('open PR backlog', () => {
  it('summarizes the backlog with stats, age buckets, and time-to-merge', () => {
    renderReport();

    const section = screen.getByTestId(openPrAgeStoryTestIds.section);
    expect(section).toHaveTextContent(openPrAgeStoryCopy.heading);
    expect(section).toHaveTextContent('102');
    expect(section).toHaveTextContent('still open');
    expect(section).toHaveTextContent('74 days');
    expect(section).toHaveTextContent('average age');

    const breakdown = screen.getByTestId(openPrAgeStoryTestIds.breakdown);
    expect(breakdown).toHaveTextContent('0–30 days');
    expect(breakdown).toHaveTextContent('40');
    expect(breakdown).toHaveTextContent('Time-to-merge in your data: p50 2d, p90 14d');
  });

  it('uses neutral copy when there is no open backlog', () => {
    renderReport({
      prBacklog: prBacklog.build({ openCount: 0, oldestOpenDays: null, openAvgAgeDays: null, openAgeBuckets: [] }),
    });

    const section = screen.getByTestId(openPrAgeStoryTestIds.section);
    expect(section).toHaveTextContent(openPrAgeStoryCopy.emptyHeading);
    expect(section).not.toHaveTextContent(openPrAgeStoryCopy.heading);
    expect(section).not.toHaveTextContent('average age');
  });
});

describe('security exposure', () => {
  it('reports the open alert count with a severity bar and top repos', () => {
    renderReport();

    expect(screen.getByTestId(riskStoryTestIds.heading)).toHaveTextContent('7 open security alerts');
    expect(screen.getByTestId(riskStoryTestIds.severityBar)).toBeInTheDocument();
    expect(screen.getByTestId(riskStoryTestIds.topReposTable)).toBeInTheDocument();
  });

  it('limits the top-repos table to five with an optional expansion', () => {
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

    expect(screen.getByTestId(`${riskStoryTestIds.topReposRow}-acme/repo-5`)).toBeInTheDocument();
    expect(screen.queryByTestId(`${riskStoryTestIds.topReposRow}-acme/repo-6`)).toBeNull();

    fireEvent.click(screen.getByTestId(riskStoryTestIds.topReposToggle));

    expect(screen.getByTestId(`${riskStoryTestIds.topReposRow}-acme/repo-6`)).toBeInTheDocument();
    expect(screen.getByTestId(riskStoryTestIds.topReposToggle)).toHaveTextContent('Show top 5');
  });

  it('warns about repos with alerts disabled and links into the appendix list', () => {
    renderReport({ cve: cveExposureOk.build({ reposWithSecurityAlertsDisabled: ['acme/a', 'acme/b'] }) });

    const warning = screen.getByTestId(riskStoryTestIds.disabledAlertsWarning);
    expect(warning).toHaveTextContent(
      'Did you know: 2 of your 24 repos do not have Dependabot security alerts enabled',
    );

    const details = appendixDetails();
    expect(details).not.toHaveAttribute('open');

    const restore = suppressNavigation();
    fireEvent.click(within(warning).getByTestId(riskStoryTestIds.disabledAlertsLink));
    restore();

    expect(details).toHaveAttribute('open');
    const repos = screen.getByTestId(methodologyAppendixTestIds.disabledAlertsRepos);
    expect(repos).toHaveTextContent('acme/a');
    expect(repos).toHaveTextContent('acme/b');
  });

  it('shows the no-alerts state when nothing is open', () => {
    renderReport({ cve: cveExposureOk.build({ totalOpenAlerts: 0 }) });

    expect(screen.getByTestId(riskStoryTestIds.heading)).toHaveTextContent(riskStoryCopy.noAlertsHeading);
    expect(screen.queryByTestId(riskStoryTestIds.severityBar)).toBeNull();
  });

  it('explains how to grant the scope when CVE data could not be read', () => {
    renderReport({ cve: cveExposureScopeMissing.build() });

    expect(screen.getByTestId(riskStoryTestIds.heading)).toHaveTextContent(riskStoryCopy.scopeMissingHeading);
    expect(screen.getByTestId(riskStoryTestIds.scopeRefreshCommand)).toHaveTextContent(
      'gh auth refresh -s security_events',
    );
  });
});

describe('methodology appendix', () => {
  it('stays collapsed until opened, then exposes the calculation and raw-data tabs', () => {
    renderReport();
    expect(appendixDetails()).not.toHaveAttribute('open');

    openAppendix();

    expect(appendixDetails()).toHaveAttribute('open');
    expect(screen.getByTestId(`${methodologyAppendixTestIds.tab}-calculation`)).toBeInTheDocument();
    expect(screen.getByTestId(`${methodologyAppendixTestIds.tab}-data`)).toBeInTheDocument();
  });

  it('lists the cited sources in first-appearance order', () => {
    renderReport();
    openAppendix();

    const sources = screen.getByTestId(methodologyAppendixTestIds.sources);
    expect(sources).toHaveTextContent('1. Mohayeji et al. 2025');
    expect(sources).toHaveTextContent('2. VulnCheck, May 2026');
    expect(sources).toHaveTextContent('3. Anthropic, "Project Glasswing');
    expect(sources).toHaveTextContent('4. Anthropic, Coordinated Vulnerability Disclosure');
    expect(sources).toHaveTextContent('5. Atlassian State of Developer Experience Report 2025');
  });

  it('opens the appendix when a citation marker is clicked', () => {
    renderReport();
    expect(appendixDetails()).not.toHaveAttribute('open');

    const restore = suppressNavigation();
    fireEvent.click(screen.getAllByTestId(footnoteReferenceTestId)[0] as HTMLElement);
    restore();

    expect(appendixDetails()).toHaveAttribute('open');
  });

  it.each([
    { unit: 'hours', bob: '49 hrs/yr' },
    { unit: 'usd', bob: '$9,733/yr' },
  ] as const)('shows per-person annual figures in $unit on the raw-data tab', ({ unit, bob }) => {
    renderReport({ unit });
    openRawDataTab();

    expect(screen.getByTestId(`${methodologyAppendixTestIds.rawDataPerson}-merged-bob`)).toHaveTextContent(bob);
  });

  it('credits the generators with links to the repo and ContextBridge', () => {
    renderReport();

    expect(screen.getByTestId(methodologyAppendixTestIds.repoLink)).toHaveAttribute(
      'href',
      'https://github.com/contextbridge/patchwave-analysis',
    );
    expect(screen.getByTestId(methodologyAppendixTestIds.contextbridgeLink)).toHaveAttribute(
      'href',
      'https://contextbridge.ai',
    );
  });
});

describe('sections and calls to action', () => {
  it('renders every primary section', () => {
    renderReport();

    expect(screen.getByTestId(verdictTestIds.section)).toBeInTheDocument();
    expect(screen.getByTestId(automatedStoryTestIds.section)).toBeInTheDocument();
    expect(screen.getByTestId(costStoryTestIds.section)).toHaveTextContent(costStoryCopy.heading);
    expect(screen.getByTestId(openPrAgeStoryTestIds.section)).toHaveTextContent(openPrAgeStoryCopy.heading);
    expect(screen.getByTestId(riskStoryTestIds.section)).toHaveTextContent(riskStoryCopy.eyebrow);
    expect(screen.getByTestId(callToActionTestIds.section)).toHaveTextContent(callToActionCopy.heading);
    expect(screen.getByTestId(methodologyAppendixTestIds.section)).toBeInTheDocument();
  });

  it.each([
    { name: 'verdict', testId: verdictTestIds.primaryCta, label: verdictCopy.primaryCta },
    { name: 'automation waitlist', testId: automatedStoryTestIds.waitlistCta, label: callToActionCopy.ctaLabel },
    { name: 'call to action', testId: callToActionTestIds.cta, label: callToActionCopy.ctaLabel },
  ])('points the $name CTA at patchwave.ai', ({ testId, label }) => {
    renderReport();

    const cta = screen.getByTestId(testId);
    expect(cta).toHaveTextContent(label);
    expect(cta).toHaveAttribute('href', 'https://patchwave.ai');
  });
});

describe('analytics', () => {
  it.each([
    { name: 'verdict', testId: verdictTestIds.primaryCta, which: 'verdict_primary' },
    { name: 'automation waitlist', testId: automatedStoryTestIds.waitlistCta, which: 'automated_story_waitlist' },
    { name: 'call to action', testId: callToActionTestIds.cta, which: 'call_to_action_primary' },
  ])('captures cta_clicked for the $name CTA', ({ testId, which }) => {
    const analytics = new FakeAnalytics();
    renderWithAnalytics(analytics);

    const restore = suppressNavigation();
    fireEvent.click(screen.getByTestId(testId));
    restore();

    expect(analytics.captureCalls).toContainEqual({ event: 'cta_clicked', properties: { which } });
  });

  it.each([
    { field: 'hourly_rate', testId: costReceiptTestIds.rate, value: 275 },
    { field: 'minutes_per_pr', testId: costReceiptTestIds.minutes, value: 24 },
  ])('captures assumption_changed when $field is committed', ({ field, testId, value }) => {
    const analytics = new FakeAnalytics();
    renderWithAnalytics(analytics, { unit: 'usd' });

    const input = screen.getByTestId(testId);
    fireEvent.change(input, { target: { value: String(value) } });
    fireEvent.blur(input);

    expect(analytics.captureCalls).toContainEqual({ event: 'assumption_changed', properties: { field, value } });
  });

  it('captures display_unit_changed only when the unit actually changes', () => {
    const analytics = new FakeAnalytics();
    renderWithAnalytics(analytics);

    // Hours is already active, so re-selecting it captures nothing.
    fireEvent.click(screen.getByTestId(appTestIds.unitHours));
    expect(analytics.capturedEvents('display_unit_changed')).toHaveLength(0);

    fireEvent.click(screen.getByTestId(appTestIds.unitUsd));
    expect(analytics.captureCalls).toContainEqual({ event: 'display_unit_changed', properties: { unit: 'usd' } });
  });
});

function renderReport({ unit = 'hours', ...overrides }: Partial<EmbeddedReportData> & { unit?: DisplayUnit } = {}) {
  render(<App data={{ ...embeddedReportData.build(), ...overrides }} />);
  if (unit === 'usd') {
    switchToDollars();
  }
}

function renderWithAnalytics(analytics: FakeAnalytics, { unit = 'hours' }: { unit?: DisplayUnit } = {}) {
  render(
    <AnalyticsProvider value={analytics}>
      <App data={embeddedReportData.build()} />
    </AnalyticsProvider>,
  );
  if (unit === 'usd') {
    switchToDollars();
  }
}

function switchToDollars() {
  fireEvent.click(screen.getByTestId(appTestIds.unitUsd));
}

function openAppendix() {
  fireEvent.click(screen.getByTestId(methodologyAppendixTestIds.summary));
}

function openRawDataTab() {
  openAppendix();
  fireEvent.click(screen.getByTestId(`${methodologyAppendixTestIds.tab}-data`));
}

function appendixDetails(): HTMLDetailsElement {
  const details = screen.getByTestId(methodologyAppendixTestIds.section).querySelector('details');
  if (!details) {
    throw new Error('appendix <details> not found');
  }
  return details;
}

// Clicking a real <a href> would navigate the test page away. Cancel the default in the capture
// phase so React's onClick still fires (preventDefault doesn't stop propagation).
function suppressNavigation(): () => void {
  const handler = (e: Event) => e.preventDefault();
  document.addEventListener('click', handler, true);
  return () => document.removeEventListener('click', handler, true);
}
