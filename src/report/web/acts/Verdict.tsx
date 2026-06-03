import { useAnalytics } from '../analytics/AnalyticsContext.tsx';
import { Button } from '../components/ui/button.tsx';
import { useEmbeddedData } from '../data/EmbeddedDataContext.tsx';
import { fmtUsd } from '../format/money.ts';
import { useAssumptions } from '../hooks/useAssumptions.tsx';
import { CostReceipt } from '../primitives/CostReceipt.tsx';

export const verdictTestIds = {
  section: 'verdict-section',
  annualCost: 'verdict-annual-cost',
  primaryCta: 'verdict-primary-cta',
} as const;

export const verdictCopy = {
  costLeadIn: 'Your engineering team spends this much',
  costTrailer: 'triaging, reviewing, and merging Dependabot PRs',
  primaryCta: 'See how PatchWave helps',
} as const;

export function Verdict() {
  const { derived } = useAssumptions();
  const { prBacklog } = useEmbeddedData();
  const { openCount } = prBacklog;
  const analytics = useAnalytics();

  return (
    <section data-testid={verdictTestIds.section} className="pt-4">
      {/* One card that tells the whole story: it opens with the subject, then reads as a
          single equation — observed PRs × editable assumptions × annualize = the figure. */}
      <div className="border-border bg-muted/40 rounded-xl border p-6 sm:p-8">
        <p className="text-foreground text-lg leading-snug">
          {verdictCopy.costLeadIn} {verdictCopy.costTrailer}
        </p>

        <div className="mt-5 flex flex-wrap items-center gap-x-3 gap-y-3">
          <CostReceipt />
          <span className="text-muted-foreground self-center text-2xl font-light" aria-hidden>
            =
          </span>
          <h1
            data-testid={verdictTestIds.annualCost}
            className="text-foreground text-4xl leading-none font-medium tracking-tight tabular-nums sm:text-5xl"
          >
            ~{fmtUsd(derived.annualCostUsd)}
            <span className="text-muted-foreground text-xl font-normal sm:text-2xl">/year</span>
          </h1>
        </div>

        {openCount > 0 && (
          <p className="text-muted-foreground mt-4 text-sm leading-snug">
            Does not include the {openCount.toLocaleString()} Dependabot PRs that are still open
          </p>
        )}
      </div>

      <Button asChild className="mt-7">
        <a
          data-testid={verdictTestIds.primaryCta}
          href="https://patchwave.ai"
          onClick={() => analytics.capture('cta_clicked', { which: 'verdict_primary' })}
        >
          {verdictCopy.primaryCta}
        </a>
      </Button>
    </section>
  );
}
