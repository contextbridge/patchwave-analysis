import { useAnalytics } from '../analytics/AnalyticsContext.tsx';
import { useEmbeddedData } from '../data/EmbeddedDataContext.tsx';
import { fmtUsd } from '../format/money.ts';
import { useAssumptions } from '../hooks/useAssumptions.tsx';
import { AssumptionInput } from '../primitives/AssumptionInput.tsx';

export const verdictTestIds = {
  section: 'verdict-section',
  annualCost: 'verdict-annual-cost',
  assumptionsDetails: 'verdict-assumptions-details',
  cveLine: 'verdict-cve-line',
  primaryCta: 'verdict-primary-cta',
} as const;

export const verdictCopy = {
  eyebrow: 'Dependabot diagnostic',
  costDescription: 'Engineer time your team spends to triage, review, and merge Dependabot PRs at the current pace.',
  primaryCta: 'Looking to automate this? See the PatchWave waitlist →',
  cveScopeMissing: 'CVE exposure not measured (missing GitHub scope)',
  cveNoData: 'CVE exposure not available',
} as const;

export function Verdict() {
  const data = useEmbeddedData();
  const { derived } = useAssumptions();
  const analytics = useAnalytics();

  const generatedDate = data.meta.generatedAt.slice(0, 10);
  const pr = data.prBacklog;
  const openLabel = pr.openCount === 1 ? 'open Dependabot PR' : 'open Dependabot PRs';
  const oldestSuffix = pr.oldestOpenDays !== null ? `, oldest ${pr.oldestOpenDays} days` : '';

  return (
    <section data-testid={verdictTestIds.section} className="pt-4">
      <div className="text-muted-foreground text-xs font-medium tracking-[0.16em] uppercase">{verdictCopy.eyebrow}</div>
      <div className="text-foreground mt-2 font-mono text-sm">{data.meta.org}</div>

      <h1
        data-testid={verdictTestIds.annualCost}
        className="text-foreground mt-8 text-5xl leading-none font-medium tracking-tight tabular-nums sm:text-7xl"
      >
        {fmtUsd(derived.annualCostUsd)}
        <span className="text-muted-foreground text-2xl font-normal sm:text-3xl">/year</span>
      </h1>
      <p className="text-foreground mt-4 max-w-2xl text-lg leading-relaxed">{verdictCopy.costDescription}</p>

      <ul className="text-foreground mt-6 space-y-1.5 text-base">
        <li>
          <span className="font-semibold tabular-nums">{pr.mergedInWindowCount.toLocaleString()}</span> Dependabot PRs
          merged in the last {data.meta.windowDays} days
        </li>
        <li>
          <span className="font-semibold tabular-nums">{pr.openCount.toLocaleString()}</span> {openLabel}
          {oldestSuffix}
        </li>
        <CveLineItem />
      </ul>

      <a
        data-testid={verdictTestIds.primaryCta}
        href="https://patchwave.ai"
        onClick={() => analytics.capture('cta_clicked', { which: 'verdict_primary' })}
        className="text-primary mt-7 inline-block text-sm font-medium underline underline-offset-4 hover:opacity-80"
      >
        {verdictCopy.primaryCta}
      </a>

      <details
        data-testid={verdictTestIds.assumptionsDetails}
        className="border-border bg-card mt-7 rounded-md border no-print"
      >
        <summary className="text-foreground hover:text-muted-foreground cursor-pointer px-4 py-2.5 text-sm font-medium select-none">
          Adjust the assumptions
        </summary>
        <div className="border-border border-t p-4">
          <AssumptionInput variant="panel" />
          <p className="text-muted-foreground mt-3 text-xs">
            Numbers throughout the report recalculate as you change these. Defaults are conservative.
          </p>
        </div>
      </details>

      <div className="text-muted-foreground mt-8 text-xs">
        Generated {generatedDate}. {data.meta.windowDays}-day rolling window. {data.meta.totalReposScanned} repos
        scanned.
      </div>
    </section>
  );
}

function CveLineItem() {
  const cve = useEmbeddedData().cve;
  if (cve.status === 'scope-missing') {
    return (
      <li data-testid={verdictTestIds.cveLine} className="text-muted-foreground">
        {verdictCopy.cveScopeMissing}
      </li>
    );
  }
  if (cve.status === 'no-data') {
    return (
      <li data-testid={verdictTestIds.cveLine} className="text-muted-foreground">
        {verdictCopy.cveNoData}
      </li>
    );
  }
  return (
    <li data-testid={verdictTestIds.cveLine}>
      <span className="font-semibold tabular-nums">{cve.totalOpenAlerts.toLocaleString()}</span> open security alerts:{' '}
      <span className="text-destructive font-semibold tabular-nums">{cve.bySeverity.critical} critical</span>,{' '}
      <span className="text-tangerine font-semibold tabular-nums">{cve.bySeverity.high} high</span>
    </li>
  );
}
