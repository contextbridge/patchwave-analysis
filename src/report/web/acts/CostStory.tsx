import { useState } from 'react';
import { useEmbeddedData } from '../data/EmbeddedDataContext.tsx';
import { useFormatAmount } from '../format/amount.ts';
import { useAssumptions } from '../hooks/useAssumptions.tsx';
import { useDisplayUnit } from '../hooks/useDisplayUnit.tsx';
import { ActHeader } from '../primitives/ActHeader.tsx';
import { Card } from '../primitives/Card.tsx';
import { CostReceipt } from '../primitives/CostReceipt.tsx';
import { PersonRow } from '../primitives/PersonRow.tsx';
import { Stat, StatGrid } from '../primitives/Stat.tsx';
import { SubHeading } from '../primitives/SubHeading.tsx';

export const costStorySectionId = 'cost';

export const costStoryTestIds = {
  section: 'cost-story-section',
  windowCost: 'cost-story-window-cost',
  monthlyCost: 'cost-story-monthly-cost',
  annualCost: 'cost-story-annual-cost',
  peopleTable: 'cost-story-people-table',
  peopleValueHeader: 'cost-story-people-value-header',
  peopleRow: 'cost-story-person',
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
  const { unit } = useDisplayUnit();
  const formatAmount = useFormatAmount();

  const { humanMergeCount } = data.costEstimate;
  const { openCount } = data.prBacklog;

  return (
    <section id={costStorySectionId} data-testid={costStoryTestIds.section} className="scroll-mt-24">
      <ActHeader icon="clock" eyebrow={costStoryCopy.eyebrow}>
        {costStoryCopy.heading}
      </ActHeader>

      <div className="mt-6">
        <Card>
          <CostReceipt />
          {openCount > 0 && (
            <p className="text-muted-foreground mt-4 mb-0 text-sm leading-snug">
              Does not include the {openCount.toLocaleString()} Dependabot PRs that are still open
            </p>
          )}
        </Card>
      </div>

      <p className="text-foreground mt-5 text-base leading-relaxed">
        In the last {data.meta.windowDays} days, your team merged{' '}
        <span className="font-semibold tabular-nums">{humanMergeCount.toLocaleString()}</span> Dependabot PRs by hand.
        Anything a bot auto-merged is left out. At{' '}
        <span className="font-semibold tabular-nums">{assumptions.minutesPerPr}</span> minutes per PR
        {unit === 'usd' && (
          <>
            {' '}
            and <span className="font-semibold tabular-nums">${assumptions.hourlyRateUsd}/hr</span>
          </>
        )}
        , that comes out to:
      </p>

      <div className="mt-6">
        <StatGrid columns={3}>
          <Stat
            valueTestId={costStoryTestIds.windowCost}
            label={`Last ${data.costEstimate.windowDays} days`}
            value={formatAmount({ hours: derived.windowHours, usd: derived.windowCostUsd })}
          />
          <Stat
            valueTestId={costStoryTestIds.monthlyCost}
            label="Monthly run rate"
            value={formatAmount({ hours: derived.monthlyHours, usd: derived.monthlyCostUsd }, '/mo')}
          />
          <Stat
            valueTestId={costStoryTestIds.annualCost}
            label="Annualized"
            value={formatAmount({ hours: derived.annualHours, usd: derived.annualCostUsd }, '/yr')}
            highlight
          />
        </StatGrid>
      </div>

      <PeopleTable windowDays={data.meta.windowDays} />

      <p className="text-muted-foreground mt-6 text-sm leading-relaxed">
        The 12 min/PR default covers the context switch, review, and merge for a single PR. Anything a bot merged is
        left out, so these totals only count human effort.
      </p>
    </section>
  );
}

function PeopleTable({ windowDays }: { windowDays: number }) {
  const { derived } = useAssumptions();
  const { unit } = useDisplayUnit();
  const formatAmount = useFormatAmount();
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
      <SubHeading>Who's bearing this cost</SubHeading>
      <div
        data-testid={costStoryTestIds.peopleTable}
        className="border-border bg-card mt-4 overflow-hidden rounded-md border"
      >
        <table className="w-full">
          <thead className="bg-muted">
            <tr className="eyebrow text-muted-foreground text-left">
              <th className="px-3 py-2.5">Person</th>
              <th className="px-3 py-2.5 text-right">Count</th>
              <th data-testid={costStoryTestIds.peopleValueHeader} className="px-3 py-2.5 text-right">
                {unit === 'hours' ? 'Time' : 'Cost'} over last {windowDays} days
              </th>
              <th className="px-3 py-2.5 text-right">Annualized</th>
            </tr>
          </thead>
          <tbody>
            {visiblePeople.map((r) => (
              <PersonRow
                key={r.login}
                testId={`${costStoryTestIds.peopleRow}-${r.login}`}
                login={r.login}
                mergedCount={r.mergedCount}
                reviewedCount={r.reviewedCount}
                windowValue={formatAmount({ hours: r.windowHours, usd: r.windowCostUsd })}
                annualValue={formatAmount({ hours: r.annualHours, usd: r.annualCostUsd })}
              />
            ))}
            {hiddenCount > 0 || expanded ? (
              <tr className="border-border border-t">
                <td colSpan={4} className="px-3 py-2.5 text-center">
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
  windowHours: number;
  annualHours: number;
}

interface CombinedPersonRow {
  login: string;
  mergedCount: number;
  reviewedCount: number;
  windowCostUsd: number;
  annualCostUsd: number;
  windowHours: number;
  annualHours: number;
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
      windowHours: m.windowHours,
      annualHours: m.annualHours,
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
        windowHours: 0,
        annualHours: 0,
      } satisfies CombinedPersonRow);
    row.reviewedCount += r.count;
    row.windowCostUsd += r.windowCostUsd;
    row.annualCostUsd += r.annualCostUsd;
    row.windowHours += r.windowHours;
    row.annualHours += r.annualHours;
    rows.set(r.login, row);
  }
  return [...rows.values()].sort(
    (a, b) => b.annualCostUsd - a.annualCostUsd || b.windowCostUsd - a.windowCostUsd || a.login.localeCompare(b.login),
  );
}
