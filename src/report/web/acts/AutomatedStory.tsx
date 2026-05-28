import { useState } from 'react';
import { useAnalytics } from '../analytics/AnalyticsContext.tsx';
import { Button } from '../components/ui/button.tsx';
import { useEmbeddedData } from '../data/EmbeddedDataContext.tsx';
import { fmtUsd } from '../format/money.ts';
import { useAssumptions } from '../hooks/useAssumptions.tsx';
import { Citation } from '../primitives/Citation.tsx';
import { callToActionCopy } from './CallToAction.tsx';

export const automatedStoryTestIds = {
  section: 'automated-story-section',
  todayCost: 'automated-story-today-cost',
  patchwaveCost: 'automated-story-patchwave-cost',
  delta: 'automated-story-delta',
  shareSlider: 'automated-story-share-slider',
  waitlistCta: 'automated-story-waitlist-cta',
  secondaryCta: 'automated-story-secondary-cta',
} as const;

export const automatedStoryCopy = {
  secondaryCta: 'See how PatchWave helps',
} as const;

const SHARE_MIN = 10;
const SHARE_MAX = 90;
const SHARE_STEP = 5;
const SHARE_DEFAULT = 60;
const SHARE_MID = (SHARE_MIN + SHARE_MAX) / 2;
const SHARE_STOPS = Array.from(
  { length: (SHARE_MAX - SHARE_MIN) / SHARE_STEP + 1 },
  (_, i) => SHARE_MIN + i * SHARE_STEP,
);

export function AutomatedStory() {
  const { assumptions, displayMode, derived } = useAssumptions();
  const { costEstimate } = useEmbeddedData();
  const analytics = useAnalytics();
  const [sharePct, setSharePct] = useState(SHARE_DEFAULT);

  const totalActions = costEstimate.humanMergeCount + costEstimate.humanReviewCount;
  const quarterlyHours = actionsToHours(totalActions, assumptions.minutesPerPr);
  const patchwaveSavingsHours = Math.round(quarterlyHours * (sharePct / 100));
  const patchwaveSavingsUsd = Math.round(derived.annualCostUsd * (sharePct / 100));

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
          value={displayMode === 'time' ? fmtHoursPerQuarter(quarterlyHours) : `${fmtUsd(derived.annualCostUsd)}/yr`}
          sub={
            displayMode === 'time'
              ? 'engineer time per quarter spent on Dependabot PRs'
              : 'loaded engineering cost per year spent on Dependabot PRs'
          }
        />
        <div className="flex flex-col items-center justify-center px-2 py-2">
          <div
            data-testid={automatedStoryTestIds.delta}
            className="text-primary text-4xl font-semibold tabular-nums sm:text-5xl"
          >
            {sharePct}%
          </div>
          <div className="text-muted-foreground mt-1 text-xs font-medium tracking-[0.14em] uppercase">
            PRs auto-merged
          </div>
        </div>
        <CompareCard
          testId={automatedStoryTestIds.patchwaveCost}
          label="PatchWave savings"
          value={
            displayMode === 'time' ? fmtHoursPerQuarter(patchwaveSavingsHours) : `${fmtUsd(patchwaveSavingsUsd)}/yr`
          }
          sub={displayMode === 'time' ? 'engineer time saved per quarter' : 'loaded engineering cost saved per year'}
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
          step={SHARE_STEP}
          value={sharePct}
          onChange={(e) => setSharePct(Number(e.target.value))}
          className="accent-primary mt-3 block w-full"
        />
        <div className="mt-2 flex justify-between px-[3px]" aria-hidden>
          {SHARE_STOPS.map((stop) => (
            <span
              key={stop}
              className={`h-1.5 w-1.5 rounded-full ${stop <= sharePct ? 'bg-primary' : 'bg-muted-foreground/30'}`}
            />
          ))}
        </div>
        <div className="text-muted-foreground mt-1 flex justify-between text-xs tabular-nums">
          <span>{SHARE_MIN}%</span>
          <span>{SHARE_MID}%</span>
          <span>{SHARE_MAX}%</span>
        </div>
      </div>

      <p className="text-muted-foreground mt-7 text-sm leading-relaxed">
        Most Dependabot PRs arrive with no signal that the upgrade is safe. On actively maintained JavaScript projects,
        43% of security PRs never get merged. Maintainers hold back over compatibility worries, not because the bot is
        wrong
        <Citation source="mohayeji-2025" />.
      </p>

      <div className="mt-6 flex flex-wrap gap-3 no-print">
        <Button asChild>
          <a
            data-testid={automatedStoryTestIds.waitlistCta}
            href="https://patchwave.ai"
            onClick={() => analytics.capture('cta_clicked', { which: 'automated_story_waitlist' })}
          >
            {callToActionCopy.ctaLabel}
          </a>
        </Button>
        <Button asChild variant="secondary">
          <a
            data-testid={automatedStoryTestIds.secondaryCta}
            href="https://patchwave.ai"
            onClick={() => analytics.capture('cta_clicked', { which: 'automated_story_secondary' })}
          >
            {automatedStoryCopy.secondaryCta}
          </a>
        </Button>
      </div>
    </section>
  );
}

function CompareCard({
  label,
  value,
  sub,
  testId,
  accent = false,
}: {
  label: string;
  value: string;
  sub: string;
  testId: string;
  accent?: boolean;
}) {
  return (
    <div className="border-border bg-card flex flex-col rounded-md border p-5">
      <div className="text-muted-foreground text-xs font-medium tracking-[0.14em] uppercase">{label}</div>
      <div
        data-testid={testId}
        className={`${accent ? 'text-savings' : 'text-foreground'} mt-2 text-3xl font-medium tabular-nums sm:text-4xl`}
      >
        {value}
      </div>
      <div className="text-muted-foreground mt-1.5 text-sm leading-relaxed">{sub}</div>
    </div>
  );
}

function actionsToHours(count: number, minutesPerPr: number): number {
  return Math.round((count * minutesPerPr) / 60);
}

function fmtHoursPerQuarter(hours: number): string {
  if (hours <= 0) return '<1 hr/qtr';
  return `~${hours.toLocaleString()} ${hours === 1 ? 'hr' : 'hrs'}/qtr`;
}
