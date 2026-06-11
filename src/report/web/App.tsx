import { useRef } from 'react';
import { AutomatedStory } from './acts/AutomatedStory.tsx';
import { CallToAction } from './acts/CallToAction.tsx';
import { CostStory } from './acts/CostStory.tsx';
import { MethodologyAppendix } from './acts/MethodologyAppendix.tsx';
import { OpenPrAgeStory } from './acts/OpenPrAgeStory.tsx';
import { RiskStory } from './acts/RiskStory.tsx';
import { Verdict } from './acts/Verdict.tsx';
import { useAnalytics } from './analytics/AnalyticsContext.tsx';
import { EmbeddedDataProvider } from './data/EmbeddedDataContext.tsx';
import { AssumptionsProvider } from './hooks/useAssumptions.tsx';
import { AssumptionsDisclosureProvider } from './hooks/useAssumptionsDisclosure.tsx';
import { type DisplayUnit, DisplayUnitProvider, useDisplayUnit } from './hooks/useDisplayUnit.tsx';
import { FootnoteProvider } from './hooks/useFootnotes.tsx';
import { BrandMark } from './primitives/BrandMark.tsx';
import type { EmbeddedReportData } from './types.ts';

export const appTestIds = {
  main: 'report-main',
  header: 'report-header',
  headerContext: 'report-header-context',
  unitToggle: 'report-unit-toggle',
  unitUsd: 'report-unit-usd',
  unitHours: 'report-unit-hours',
} as const;

const appCopy = {
  analysisFor: 'Analysis for',
} as const;

export function App({ data }: { data: EmbeddedReportData }) {
  return (
    <EmbeddedDataProvider value={data}>
      <AssumptionsProvider data={data}>
        <DisplayUnitProvider>
          <AssumptionsDisclosureProvider>
            <FootnoteProvider>
              <ReportHeader org={data.meta.org} />
              <main data-testid={appTestIds.main} className="mx-auto max-w-[1024px] px-6 pb-32 pt-12 sm:pt-16">
                <Verdict />
                <AutomatedStory />
                <CostStory />
                <OpenPrAgeStory />
                <RiskStory />
                <CallToAction />
                <MethodologyAppendix />
              </main>
            </FootnoteProvider>
          </AssumptionsDisclosureProvider>
        </DisplayUnitProvider>
      </AssumptionsProvider>
    </EmbeddedDataProvider>
  );
}

function ReportHeader({ org }: { org: string }) {
  return (
    <header
      data-testid={appTestIds.header}
      className="border-border bg-background sticky top-0 z-50 flex h-12 items-center justify-between border-b px-6 no-print"
    >
      <div className="flex min-w-0 items-center gap-3">
        <a href="https://patchwave.ai" className="text-foreground flex shrink-0 items-center gap-2 no-underline">
          <BrandMark className="text-foreground size-4" />
          <span className="text-foreground text-[15px] font-semibold tracking-tight">PatchWave</span>
        </a>
        <span className="bg-border h-4 w-px shrink-0" aria-hidden />
        <p
          data-testid={appTestIds.headerContext}
          className="text-muted-foreground truncate text-sm leading-none font-medium"
        >
          {appCopy.analysisFor} {org}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-3">
        <UnitToggle />
        <a
          href="https://patchwave.ai"
          className="text-muted-foreground hover:text-foreground hidden shrink-0 text-xs font-medium tracking-wide uppercase no-underline sm:inline"
        >
          patchwave.ai
        </a>
      </div>
    </header>
  );
}

function UnitToggle() {
  const { unit, setUnit } = useDisplayUnit();
  const analytics = useAnalytics();
  const buttonRefs = { hours: useRef<HTMLButtonElement>(null), usd: useRef<HTMLButtonElement>(null) };
  const select = (next: DisplayUnit) => {
    if (next === unit) return;
    setUnit(next);
    analytics.capture('display_unit_changed', { unit: next });
  };
  const options = [
    { value: 'hours', label: 'hrs', ariaLabel: 'Hours', testId: appTestIds.unitHours },
    { value: 'usd', label: '$', ariaLabel: 'Dollars', testId: appTestIds.unitUsd },
  ] as const;
  return (
    <div
      data-testid={appTestIds.unitToggle}
      role="radiogroup"
      aria-label="Show engineering cost as"
      className="border-border bg-card inline-flex rounded-md border p-0.5"
      onKeyDown={(event) => {
        if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
          event.preventDefault();
          const next = unit === 'usd' ? 'hours' : 'usd';
          select(next);
          buttonRefs[next].current?.focus();
        }
      }}
    >
      {options.map((option) => (
        <button
          key={option.value}
          ref={buttonRefs[option.value]}
          type="button"
          role="radio"
          aria-checked={unit === option.value}
          aria-label={option.ariaLabel}
          tabIndex={unit === option.value ? 0 : -1}
          data-testid={option.testId}
          onClick={() => select(option.value)}
          className={`rounded px-2 py-0.5 text-xs font-medium whitespace-nowrap transition-colors ${
            unit === option.value ? 'bg-foreground text-background' : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
