import { useRef } from 'react';
import type { RepositorySelection } from '../../types.ts';
import { AutomatedStory } from './acts/AutomatedStory.tsx';
import { CallToAction } from './acts/CallToAction.tsx';
import { CostStory } from './acts/CostStory.tsx';
import { MethodologyAppendix } from './acts/MethodologyAppendix.tsx';
import { OpenPrAgeStory } from './acts/OpenPrAgeStory.tsx';
import { RiskStory } from './acts/RiskStory.tsx';
import { Verdict } from './acts/Verdict.tsx';
import { EmbeddedDataProvider } from './data/EmbeddedDataContext.tsx';
import { scopeLabel } from './format/scope.ts';
import { AssumptionsProvider } from './hooks/useAssumptions.tsx';
import { AssumptionsDisclosureProvider } from './hooks/useAssumptionsDisclosure.tsx';
import { type DisplayUnit, DisplayUnitProvider, useDisplayUnit } from './hooks/useDisplayUnit.tsx';
import { FootnoteProvider } from './hooks/useFootnotes.tsx';
import { Container } from './primitives/Container.tsx';
import { Logo } from './primitives/Logo.tsx';
import { PixelRule } from './primitives/PixelRule.tsx';
import { WaveDivider } from './primitives/WaveDivider.tsx';
import { reportCtaUrls } from './reportCtaUrls.ts';
import type { EmbeddedReportData } from './types.ts';

export const appTestIds = {
  main: 'report-main',
  header: 'report-header',
  headerContext: 'report-header-context',
  headerLogo: 'report-header-logo',
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
              <ReportHeader org={data.meta.org} repositoryScope={data.meta.repositoryScope} />
              <main data-testid={appTestIds.main}>
                <Verdict />
                <SceneEdge variant="out" />
                <Container className="pt-12 pb-24 sm:pt-16">
                  <AutomatedStory />
                  <ActBreak />
                  <CostStory />
                  <ActBreak />
                  <OpenPrAgeStory />
                  <ActBreak />
                  <RiskStory />
                </Container>
                <SceneEdge variant="into" />
                <CallToAction />
                <SceneEdge variant="out" />
                <Container className="pt-12 pb-32 sm:pt-16">
                  <MethodologyAppendix />
                </Container>
              </main>
            </FootnoteProvider>
          </AssumptionsDisclosureProvider>
        </DisplayUnitProvider>
      </AssumptionsProvider>
    </EmbeddedDataProvider>
  );
}

function ReportHeader({ org, repositoryScope }: { org: string; repositoryScope: RepositorySelection }) {
  const label = scopeLabel(repositoryScope);
  return (
    <header
      data-testid={appTestIds.header}
      className="border-brand-violet-night bg-background sticky top-0 z-50 flex h-16 items-center justify-between gap-4 border-b-2 px-4 no-print sm:px-6"
    >
      <div className="flex min-w-0 items-center gap-3 sm:gap-4">
        <a
          data-testid={appTestIds.headerLogo}
          href={reportCtaUrls.header}
          className="flex shrink-0 items-center no-underline transition-opacity hover:opacity-80"
        >
          <Logo />
        </a>
        <span className="bg-border h-6 w-0.5 shrink-0" aria-hidden />
        <p
          data-testid={appTestIds.headerContext}
          className="text-muted-foreground min-w-0 truncate text-sm leading-none font-medium"
        >
          {appCopy.analysisFor} {label ? `${org} (${label})` : org}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-4">
        <UnitToggle />
        <a
          href={reportCtaUrls.header}
          className="eyebrow text-foreground hover:text-primary hidden shrink-0 no-underline lg:inline"
        >
          patchwave.ai
        </a>
      </div>
    </header>
  );
}

function UnitToggle() {
  const { unit, setUnit } = useDisplayUnit();
  const buttonRefs = { hours: useRef<HTMLButtonElement>(null), usd: useRef<HTMLButtonElement>(null) };
  const select = (next: DisplayUnit) => {
    if (next === unit) return;
    setUnit(next);
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
      className="border-border bg-card inline-flex rounded-md border p-0.5 font-mono"
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
          className={`rounded px-2.5 py-1 text-xs font-bold tracking-wider whitespace-nowrap uppercase transition-colors ${
            unit === option.value ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function ActBreak() {
  return (
    <div className="my-16 sm:my-20 print:my-10">
      <PixelRule />
    </div>
  );
}

/** Waves where a scene meets the white page. */
function SceneEdge({ variant }: { variant: 'into' | 'out' }) {
  return (
    <div className="no-print">
      <WaveDivider variant={variant} />
    </div>
  );
}
