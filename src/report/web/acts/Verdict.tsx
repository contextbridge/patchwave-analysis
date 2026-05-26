import { useAnalytics } from '../analytics/AnalyticsContext.tsx';
import { Button } from '../components/ui/button.tsx';
import { useEmbeddedData } from '../data/EmbeddedDataContext.tsx';
import { fmtUsd } from '../format/money.ts';
import { useAssumptions } from '../hooks/useAssumptions.tsx';
import { AssumptionsFootnote } from '../primitives/AssumptionsFootnote.tsx';

export const verdictTestIds = {
  section: 'verdict-section',
  annualCost: 'verdict-annual-cost',
  cveLine: 'verdict-cve-line',
  primaryCta: 'verdict-primary-cta',
} as const;

export const verdictCopy = {
  costLeadIn: 'Your engineering team spends',
  costTrailer: 'triaging, reviewing, and merging Dependabot PRs',
  primaryCta: 'See how PatchWave helps',
  cveScopeMissing: 'CVE exposure not measured (missing GitHub scope)',
} as const;

export function Verdict() {
  const { derived } = useAssumptions();
  const analytics = useAnalytics();

  return (
    <section data-testid={verdictTestIds.section} className="pt-4">
      <p className="text-foreground text-lg leading-snug">{verdictCopy.costLeadIn}</p>
      <h1
        data-testid={verdictTestIds.annualCost}
        className="text-foreground mt-2 text-5xl leading-none font-medium tracking-tight tabular-nums sm:text-7xl"
      >
        ~{fmtUsd(derived.annualCostUsd)}
        <span className="text-muted-foreground text-2xl font-normal sm:text-3xl">/year</span>
      </h1>
      <p className="text-foreground mt-2 max-w-2xl text-lg leading-snug">
        {verdictCopy.costTrailer}, based on adjustable
        <AssumptionsFootnote from="verdict" /> assumptions
      </p>

      <SupportingFacts />

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

// One dense line under the headline: volume and time first, the alert count as a
// tail signal. The CVE fragment also carries the not-measured state so the
// report never silently drops the security signal.
function SupportingFacts() {
  const { prBacklog: pr } = useEmbeddedData();
  const oldestSuffix = pr.oldestOpenDays !== null ? ` (oldest ${pr.oldestOpenDays} days)` : '';

  return (
    <p className="text-foreground mt-6 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-base">
      <span>
        <span className="font-semibold tabular-nums">{pr.mergedInWindowCount.toLocaleString()}</span> Dependabot PRs
        merged
      </span>
      <Dot />
      <span>
        <span className="font-semibold tabular-nums">{pr.openCount.toLocaleString()}</span> still open{oldestSuffix}
      </span>
      <Dot />
      <CveFact />
    </p>
  );
}

function CveFact() {
  const cve = useEmbeddedData().cve;
  if (cve.status === 'scope-missing') {
    return (
      <span data-testid={verdictTestIds.cveLine} className="text-muted-foreground">
        {verdictCopy.cveScopeMissing}
      </span>
    );
  }
  return (
    <span data-testid={verdictTestIds.cveLine}>
      <span className="font-semibold tabular-nums">{cve.totalOpenAlerts.toLocaleString()}</span> open security alerts
    </span>
  );
}

function Dot() {
  return (
    <span className="text-muted-foreground select-none" aria-hidden>
      ·
    </span>
  );
}
