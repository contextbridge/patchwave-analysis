import { useAnalytics } from '../analytics/AnalyticsContext.tsx';
import { Button } from '../components/ui/button.tsx';
import { useEmbeddedData } from '../data/EmbeddedDataContext.tsx';
import { useAssumptions } from '../hooks/useAssumptions.tsx';
import { HeroAssumptions } from '../primitives/HeroAssumptions.tsx';

export const verdictTestIds = {
  section: 'verdict-section',
  annualCost: 'verdict-annual-cost',
  primaryCta: 'verdict-primary-cta',
} as const;

export const verdictCopy = {
  costLeadIn: 'Your engineering team spends',
  costTrailer: 'triaging, reviewing, and merging Dependabot PRs',
  primaryCta: 'See how PatchWave helps',
} as const;

export function Verdict() {
  const { assumptions } = useAssumptions();
  const { costEstimate, prBacklog } = useEmbeddedData();
  const { openCount } = prBacklog;
  const analytics = useAnalytics();
  const totalActions = costEstimate.humanMergeCount + costEstimate.humanReviewCount;
  const quarterlyHours = actionsToHours(totalActions, assumptions.minutesPerPr);

  return (
    <section data-testid={verdictTestIds.section} className="pt-4">
      <p className="text-foreground text-lg leading-snug">{verdictCopy.costLeadIn}</p>
      <h1
        data-testid={verdictTestIds.annualCost}
        className="text-foreground mt-2 text-5xl leading-none font-medium tracking-tight tabular-nums sm:text-7xl"
      >
        ~{fmtHours(quarterlyHours)}
        <span className="text-muted-foreground text-2xl font-normal sm:text-3xl">/quarter</span>
      </h1>
      <p className="text-foreground mt-2 max-w-2xl text-lg leading-snug">
        {verdictCopy.costTrailer}
        {openCount > 0 && (
          <span className="text-muted-foreground"> (not including the {openCount.toLocaleString()} still open)</span>
        )}
      </p>

      <Button asChild className="mt-7">
        <a
          data-testid={verdictTestIds.primaryCta}
          href="https://patchwave.ai"
          onClick={() => analytics.capture('cta_clicked', { which: 'verdict_primary' })}
        >
          {verdictCopy.primaryCta}
        </a>
      </Button>

      <div className="mt-7">
        <HeroAssumptions />
      </div>
    </section>
  );
}

function actionsToHours(count: number, minutesPerPr: number): number {
  return (count * minutesPerPr) / 60;
}

function fmtHours(hours: number): string {
  return `${Math.round(hours).toLocaleString()} engineer-hours`;
}
