import { AutomatedStory } from './acts/AutomatedStory.tsx';
import { CallToAction } from './acts/CallToAction.tsx';
import { CostStory } from './acts/CostStory.tsx';
import { MethodologyAppendix } from './acts/MethodologyAppendix.tsx';
import { OpenPrAgeStory } from './acts/OpenPrAgeStory.tsx';
import { RiskStory } from './acts/RiskStory.tsx';
import { Verdict } from './acts/Verdict.tsx';
import { EmbeddedDataProvider } from './data/EmbeddedDataContext.tsx';
import { AssumptionsProvider } from './hooks/useAssumptions.tsx';
import { AssumptionsDisclosureProvider } from './hooks/useAssumptionsDisclosure.tsx';
import { FootnoteProvider } from './hooks/useFootnotes.tsx';
import { BrandMark } from './primitives/BrandMark.tsx';
import type { EmbeddedReportData } from './types.ts';

export const appTestIds = {
  main: 'report-main',
  header: 'report-header',
  headerContext: 'report-header-context',
} as const;

const appCopy = {
  analysisFor: 'Analysis for',
} as const;

export function App({ data }: { data: EmbeddedReportData }) {
  return (
    <EmbeddedDataProvider value={data}>
      <AssumptionsProvider data={data}>
        <AssumptionsDisclosureProvider>
          <FootnoteProvider>
            <ReportHeader org={data.meta.org} />
            <main data-testid={appTestIds.main} className="mx-auto max-w-4xl px-6 pb-32 pt-12 sm:pt-16">
              <Verdict />
              <CostStory />
              <OpenPrAgeStory />
              <RiskStory />
              <AutomatedStory />
              <CallToAction />
              <MethodologyAppendix />
            </main>
          </FootnoteProvider>
        </AssumptionsDisclosureProvider>
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
      <a
        href="https://patchwave.ai"
        className="text-muted-foreground hover:text-foreground hidden shrink-0 text-xs font-medium tracking-wide uppercase no-underline sm:inline"
      >
        patchwave.ai
      </a>
    </header>
  );
}
