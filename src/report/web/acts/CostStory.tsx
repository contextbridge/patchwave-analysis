import { useState } from 'react';
import { useEmbeddedData } from '../data/EmbeddedDataContext.tsx';
import { fmtUsd } from '../format/money.ts';
import { useAssumptions } from '../hooks/useAssumptions.tsx';
import { PersonRow } from '../primitives/PersonRow.tsx';

export const costStoryTestIds = {
  section: 'cost-story-section',
  windowCost: 'cost-story-window-cost',
  monthlyCost: 'cost-story-monthly-cost',
  annualCost: 'cost-story-annual-cost',
  peopleTable: 'cost-story-people-table',
  peopleToggle: 'cost-story-people-toggle',
} as const;

const INITIAL_PEOPLE_COUNT = 5;

export const costStoryCopy = {
  eyebrow: 'Cost of dependency toil',
  heading: 'How that number is built',
} as const;

export function CostStory() {
  const data = useEmbeddedData();
  const { assumptions, derived } = useAssumptions();

  const { humanMergeCount } = data.costEstimate;

  return (
    <section data-testid={costStoryTestIds.section} className="border-foreground mt-20 border-t pt-10">
      <div className="text-muted-foreground text-xs font-medium tracking-[0.16em] uppercase">
        {costStoryCopy.eyebrow}
      </div>
      <h2 className="text-foreground mt-2 text-3xl leading-tight font-medium tracking-tight sm:text-4xl">
        {costStoryCopy.heading}
      </h2>

      <p className="text-foreground mt-5 text-base leading-relaxed">
        In the last {data.meta.windowDays} days, your team merged{' '}
        <span className="font-semibold tabular-nums">{humanMergeCount.toLocaleString()}</span> Dependabot PRs by hand.
        Anything a bot auto-merged is left out. At{' '}
        <span className="font-semibold tabular-nums">{assumptions.minutesPerPr}</span> minutes per PR and{' '}
        <span className="font-semibold tabular-nums">${assumptions.hourlyRateUsd}/hr</span>, that comes out to:
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

      <PeopleTable windowDays={data.meta.windowDays} />

      <p className="text-muted-foreground mt-6 text-sm leading-relaxed">
        The 5 min/PR default is deliberately low, so these totals lean conservative.
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

function PeopleTable({ windowDays }: { windowDays: number }) {
  const { assumptions, derived } = useAssumptions();
  const [expanded, setExpanded] = useState(false);
  const people = combinedPeopleRows(derived.mergers, derived.reviewers);
  const visiblePeople = expanded ? people : people.slice(0, INITIAL_PEOPLE_COUNT);
  const hiddenCount = people.length - visiblePeople.length;
  const hasAny = people.length > 0;
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
      <div
        data-testid={costStoryTestIds.peopleTable}
        className="border-border bg-card mt-4 overflow-hidden rounded-md border"
      >
        <table className="w-full">
          <thead className="bg-muted">
            <tr className="text-muted-foreground text-left text-xs font-medium tracking-[0.14em] uppercase">
              <th className="px-3 py-2.5">Person</th>
              <th className="px-3 py-2.5 text-right">Count</th>
              <th className="px-3 py-2.5 text-right">Time (hrs)</th>
              <th className="px-3 py-2.5 text-right">Cost over last {windowDays} days</th>
              <th className="px-3 py-2.5 text-right">Annualized</th>
            </tr>
          </thead>
          <tbody>
            {visiblePeople.map((r) => (
              <PersonRow
                key={r.login}
                login={r.login}
                mergedCount={r.mergedCount}
                reviewedCount={r.reviewedCount}
                windowHours={Math.round(r.windowCostUsd / assumptions.hourlyRateUsd)}
                windowCostUsd={r.windowCostUsd}
                annualCostUsd={r.annualCostUsd}
              />
            ))}
            {hiddenCount > 0 || expanded ? (
              <tr className="border-border border-t">
                <td colSpan={5} className="px-3 py-2.5 text-center">
                  <button
                    type="button"
                    data-testid={costStoryTestIds.peopleToggle}
                    onClick={() => setExpanded((open) => !open)}
                    className="text-muted-foreground hover:text-foreground text-sm font-medium underline-offset-4 hover:underline"
                  >
                    {expanded ? 'Show top 5' : `Show ${hiddenCount.toLocaleString()} more`}
                  </button>
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}

interface ActivityCost {
  login: string;
  count: number;
  windowCostUsd: number;
  annualCostUsd: number;
}

interface CombinedPersonRow {
  login: string;
  mergedCount: number;
  reviewedCount: number;
  windowCostUsd: number;
  annualCostUsd: number;
}

function combinedPeopleRows(mergers: readonly ActivityCost[], reviewers: readonly ActivityCost[]): CombinedPersonRow[] {
  const rows = new Map<string, CombinedPersonRow>();
  for (const m of mergers) {
    rows.set(m.login, {
      login: m.login,
      mergedCount: m.count,
      reviewedCount: 0,
      windowCostUsd: m.windowCostUsd,
      annualCostUsd: m.annualCostUsd,
    });
  }
  for (const r of reviewers) {
    const row =
      rows.get(r.login) ??
      ({
        login: r.login,
        mergedCount: 0,
        reviewedCount: 0,
        windowCostUsd: 0,
        annualCostUsd: 0,
      } satisfies CombinedPersonRow);
    row.reviewedCount += r.count;
    row.windowCostUsd += r.windowCostUsd;
    row.annualCostUsd += r.annualCostUsd;
    rows.set(r.login, row);
  }
  return [...rows.values()].sort(
    (a, b) => b.annualCostUsd - a.annualCostUsd || b.windowCostUsd - a.windowCostUsd || a.login.localeCompare(b.login),
  );
}
