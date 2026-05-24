import { AutomatedStory } from './acts/AutomatedStory.tsx';
import { CallToAction } from './acts/CallToAction.tsx';
import { CostStory } from './acts/CostStory.tsx';
import { MethodologyAppendix } from './acts/MethodologyAppendix.tsx';
import { RiskStory } from './acts/RiskStory.tsx';
import { Verdict } from './acts/Verdict.tsx';
import { EmbeddedDataProvider } from './data/EmbeddedDataContext.tsx';
import { AssumptionsProvider } from './hooks/useAssumptions.tsx';
import { BrandMark } from './primitives/BrandMark.tsx';
import type { EmbeddedReportData } from './types.ts';

export const appTestIds = {
  main: 'report-main',
  header: 'report-header',
} as const;

export function App({ data }: { data: EmbeddedReportData }) {
  return (
    <EmbeddedDataProvider value={data}>
      <AssumptionsProvider data={data}>
        <ReportHeader />
        <main data-testid={appTestIds.main} className="mx-auto max-w-4xl px-6 pb-32 pt-12 sm:pt-16">
          <Verdict />
          <CostStory />
          <RiskStory />
          <AutomatedStory />
          <CallToAction />
          <MethodologyAppendix />
        </main>
      </AssumptionsProvider>
    </EmbeddedDataProvider>
  );
}

function ReportHeader() {
  return (
    <header
      data-testid={appTestIds.header}
      className="border-border bg-background sticky top-0 z-50 flex h-12 items-center justify-between border-b px-6 no-print"
    >
      <a href="https://contextbridge.ai" className="text-foreground flex items-center gap-2 no-underline">
        <BrandMark className="text-foreground size-4" />
        <span className="text-foreground text-[15px] font-semibold tracking-tight">patchwave</span>
      </a>
      <a
        href="https://patchwave.ai"
        className="text-muted-foreground hover:text-foreground text-xs font-medium tracking-wide uppercase no-underline"
      >
        patchwave.ai
      </a>
    </header>
  );
}
