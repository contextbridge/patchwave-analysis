import { useEmbeddedData } from '../data/EmbeddedDataContext.tsx';
import { fmtDaysShort } from '../format/days.ts';
import { fmtUsd } from '../format/money.ts';
import { useAssumptions } from '../hooks/useAssumptions.tsx';
import { AssumptionInput } from '../primitives/AssumptionInput.tsx';
import { BarChart } from '../primitives/BarChart.tsx';
import { Citation } from '../primitives/Citation.tsx';
import { PersonRow } from '../primitives/PersonRow.tsx';

export const costStoryTestIds = {
  section: 'cost-story-section',
  windowCost: 'cost-story-window-cost',
  monthlyCost: 'cost-story-monthly-cost',
  annualCost: 'cost-story-annual-cost',
  peopleTable: 'cost-story-people-table',
} as const;

export const costStoryCopy = {
  eyebrow: 'Cost of dependency toil',
  heading: 'How that number is built',
  ageHeading: 'Open PRs by age',
} as const;

export function CostStory() {
  const data = useEmbeddedData();
  const { assumptions, derived } = useAssumptions();

  const merged = data.costEstimate.mergedInWindow;
  const ttm = data.prBacklog;

  return (
    <section data-testid={costStoryTestIds.section} className="border-foreground mt-20 border-t pt-10">
      <div className="text-muted-foreground text-xs font-medium tracking-[0.16em] uppercase">
        {costStoryCopy.eyebrow}
      </div>
      <h2 className="text-foreground mt-2 text-3xl leading-tight font-medium tracking-tight sm:text-4xl">
        {costStoryCopy.heading}
      </h2>

      <p className="text-foreground mt-5 text-base leading-relaxed">
        Your team merged <span className="font-semibold tabular-nums">{merged.toLocaleString()}</span> Dependabot PRs in
        the last {data.meta.windowDays} days. At{' '}
        <span className="font-semibold tabular-nums">{assumptions.minutesPerPr}</span> minutes per PR for triage and
        review and a <span className="font-semibold tabular-nums">${assumptions.hourlyRateUsd}/hr</span> loaded engineer
        rate, that comes out to:
      </p>

      <div className="bg-foreground mt-6 grid grid-cols-1 gap-px sm:grid-cols-3">
        <CostCell
          testId={costStoryTestIds.windowCost}
          label={`Last ${data.costEstimate.windowDays} days`}
          value={fmtUsd(derived.windowCostUsd)}
        />
        <CostCell
          testId={costStoryTestIds.monthlyCost}
          label="Monthly run rate"
          value={`${fmtUsd(derived.monthlyCostUsd)}/mo`}
        />
        <CostCell
          testId={costStoryTestIds.annualCost}
          label="Annualized"
          value={`${fmtUsd(derived.annualCostUsd)}/yr`}
          emphasize
        />
      </div>

      <div className="mt-6">
        <AssumptionInput variant="inline" />
      </div>

      <p className="text-muted-foreground mt-5 text-sm leading-relaxed">
        The 5 min/PR default sits at the low end of Mend's published 15&ndash;60 min/week per developer range for
        Dependabot triage
        <Citation source="mend-renovate-roi" />. Time-to-merge in your data: p50{' '}
        <span className="text-foreground font-semibold tabular-nums">{fmtDaysShort(ttm.timeToMergeP50Days)}</span>, p90{' '}
        <span className="text-foreground font-semibold tabular-nums">{fmtDaysShort(ttm.timeToMergeP90Days)}</span>.
      </p>

      <PeopleTable />

      <h3 className="text-foreground mt-12 text-sm font-semibold tracking-[0.14em] uppercase">
        {costStoryCopy.ageHeading}
      </h3>
      <div className="mt-4">
        <BarChart
          data={data.prBacklog.openAgeBuckets.map((b) => ({ label: b.label, value: b.count }))}
          emptyLabel="No open Dependabot PRs."
        />
      </div>

      <p className="text-muted-foreground mt-7 text-sm leading-relaxed">
        Volume is trending up, not down. GitHub-published CVEs rose 476% year-to-date in 2026
        <Citation source="vulncheck-2026" />, and every new CVE in your stack eventually becomes a Dependabot PR.
      </p>
    </section>
  );
}

function CostCell({
  label,
  value,
  testId,
  emphasize = false,
}: {
  label: string;
  value: string;
  testId: string;
  emphasize?: boolean;
}) {
  const baseBg = emphasize ? 'bg-foreground text-background' : 'bg-card text-foreground';
  const labelTone = emphasize ? 'text-background/60' : 'text-muted-foreground';
  return (
    <div data-testid={testId} className={`${baseBg} p-5`}>
      <div className={`${labelTone} text-xs font-medium tracking-[0.14em] uppercase`}>{label}</div>
      <div className="mt-1.5 text-2xl font-medium tabular-nums">{value}</div>
    </div>
  );
}

function PeopleTable() {
  const { derived } = useAssumptions();
  const hasAny = derived.topMergers.length + derived.topReviewers.length > 0;
  if (!hasAny) {
    return (
      <div className="border-border text-muted-foreground mt-10 rounded-md border border-dashed px-4 py-6 text-sm">
        No human merge or review activity from this window.
      </div>
    );
  }
  return (
    <div className="mt-12">
      <h3 className="text-foreground text-sm font-semibold tracking-[0.14em] uppercase">Who's bearing this cost</h3>
      <p className="text-muted-foreground mt-1.5 text-xs">
        Bot accounts excluded. Annualized = cost projected to a full year.
      </p>
      <div
        data-testid={costStoryTestIds.peopleTable}
        className="border-border bg-card mt-4 overflow-hidden rounded-md border"
      >
        <table className="w-full">
          <thead className="bg-muted">
            <tr className="text-muted-foreground text-left text-xs font-medium tracking-[0.14em] uppercase">
              <th className="px-3 py-2.5">Person</th>
              <th className="px-3 py-2.5 text-right">Count</th>
              <th className="px-3 py-2.5 text-right">Cost in window</th>
              <th className="px-3 py-2.5 text-right">Annualized</th>
            </tr>
          </thead>
          <tbody>
            {derived.topMergers.map((m) => (
              <PersonRow
                key={`m-${m.login}`}
                login={m.login}
                count={m.count}
                countLabel="merged"
                windowCostUsd={m.windowCostUsd}
                annualCostUsd={m.annualCostUsd}
              />
            ))}
            {derived.topReviewers.map((r) => (
              <PersonRow
                key={`r-${r.login}`}
                login={r.login}
                count={r.count}
                countLabel="reviewed"
                windowCostUsd={r.windowCostUsd}
                annualCostUsd={r.annualCostUsd}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
