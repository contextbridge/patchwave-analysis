import { useState } from 'react';
import { fmtUsd } from '../format/money.ts';
import { useAssumptions } from '../hooks/useAssumptions.tsx';
import { AssumptionsFootnote } from '../primitives/AssumptionsFootnote.tsx';
import { Citation } from '../primitives/Citation.tsx';

export const automatedStoryTestIds = {
  section: 'automated-story-section',
  todayCost: 'automated-story-today-cost',
  patchwaveCost: 'automated-story-patchwave-cost',
  delta: 'automated-story-delta',
  shareSlider: 'automated-story-share-slider',
} as const;

const SHARE_MIN = 50;
const SHARE_MAX = 80;
const SHARE_DEFAULT = 65;

export function AutomatedStory() {
  const { assumptions, derived } = useAssumptions();
  const [sharePct, setSharePct] = useState(SHARE_DEFAULT);

  const todayCost = derived.annualCostUsd;
  const patchwaveSavings = Math.round(todayCost * (sharePct / 100));

  return (
    <section data-testid={automatedStoryTestIds.section} className="border-foreground mt-20 border-t pt-10">
      <div className="text-muted-foreground text-xs font-medium tracking-[0.16em] uppercase">
        If this were automated
      </div>
      <h2 className="text-foreground mt-2 text-3xl leading-tight font-medium tracking-tight sm:text-4xl">
        Today vs. with PatchWave auto-merge
      </h2>

      <p className="text-foreground mt-5 text-base leading-relaxed">
        PatchWave reviews each update, merges the ones it can clear safely, and sends the rest to a human. Here's how
        much engineering time your team would get back.
      </p>

      <div className="mt-6 grid grid-cols-1 items-stretch gap-4 sm:grid-cols-[1fr_auto_1fr]">
        <CompareCard
          testId={automatedStoryTestIds.todayCost}
          label="Today"
          value={`${fmtUsd(todayCost)}/yr`}
          sub={quarterHoursLabel(todayCost, assumptions.hourlyRateUsd)}
          footnote
        />
        <div className="flex flex-col items-center justify-center px-2 py-2">
          <div
            data-testid={automatedStoryTestIds.delta}
            className="text-primary text-4xl font-semibold tabular-nums sm:text-5xl"
          >
            {sharePct}%
          </div>
          <div className="text-muted-foreground mt-1 text-xs font-medium tracking-[0.14em] uppercase">
            cost recovered
          </div>
        </div>
        <CompareCard
          testId={automatedStoryTestIds.patchwaveCost}
          label="PatchWave savings"
          value={`${fmtUsd(patchwaveSavings)}/yr`}
          sub={quarterHoursSavedLabel(patchwaveSavings, assumptions.hourlyRateUsd)}
          accent
        />
      </div>

      <div className="border-border bg-card mt-5 rounded-md border p-4 no-print">
        <label htmlFor="automerge-share" className="text-foreground text-sm font-medium">
          Assumed auto-merge share
        </label>
        <input
          id="automerge-share"
          data-testid={automatedStoryTestIds.shareSlider}
          type="range"
          min={SHARE_MIN}
          max={SHARE_MAX}
          step={5}
          value={sharePct}
          onChange={(e) => setSharePct(Number(e.target.value))}
          className="accent-primary mt-3 w-full"
        />
        <div className="text-muted-foreground mt-1 flex justify-between text-xs tabular-nums">
          <span>{SHARE_MIN}%</span>
          <span>{SHARE_MAX}%</span>
        </div>
      </div>

      <p className="text-muted-foreground mt-7 text-sm leading-relaxed">
        Most Dependabot PRs arrive with no signal about whether the upgrade is safe. Research found 67% lack any
        compatibility scoring beyond the version bump
        <Citation source="rombaut-2024" />.
      </p>
    </section>
  );
}

function CompareCard({
  label,
  value,
  sub,
  testId,
  accent = false,
  footnote = false,
}: {
  label: string;
  value: string;
  sub: string;
  testId: string;
  accent?: boolean;
  footnote?: boolean;
}) {
  return (
    <div className="border-border bg-card flex flex-col rounded-md border p-5">
      <div className="text-muted-foreground text-xs font-medium tracking-[0.14em] uppercase">{label}</div>
      <div
        data-testid={testId}
        className={`${accent ? 'text-green-400' : 'text-foreground'} mt-2 text-3xl font-medium tabular-nums sm:text-4xl`}
      >
        {value}
      </div>
      <div className="text-muted-foreground mt-1.5 text-sm leading-relaxed">
        {footnote && (
          <>
            Adjustable
            <AssumptionsFootnote from="automated-story" /> estimate
            <span aria-hidden> · </span>
          </>
        )}
        {sub}
      </div>
    </div>
  );
}

function quarterHoursLabel(costUsd: number, hourlyRateUsd: number): string {
  const hours = Math.round(costUsd / hourlyRateUsd / 4);
  if (hours <= 0) return 'under an hour of engineer time per quarter';
  return `~${hours.toLocaleString()} ${hours === 1 ? 'hour' : 'hours'} of engineer time per quarter`;
}

function quarterHoursSavedLabel(savingsUsd: number, hourlyRateUsd: number): string {
  const hours = Math.round(savingsUsd / hourlyRateUsd / 4);
  if (hours <= 0) return 'under an hour of engineer time saved per quarter';
  return `~${hours.toLocaleString()} ${hours === 1 ? 'hour' : 'hours'} of engineer time saved per quarter`;
}
