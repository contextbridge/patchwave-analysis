import { useState } from 'react';
import { ASSUMED_REVIEW_SPEEDUP } from '../../costFormulas.ts';
import { useAnalytics } from '../analytics/AnalyticsContext.tsx';
import { Button } from '../components/ui/button.tsx';
import { type Amount, useFormatAmount } from '../format/amount.ts';
import { useAssumptions } from '../hooks/useAssumptions.tsx';
import { Citation } from '../primitives/Citation.tsx';
import { callToActionCopy } from './CallToAction.tsx';

export const automatedStoryTestIds = {
  section: 'automated-story-section',
  todayCost: 'automated-story-today-cost',
  patchwaveCost: 'automated-story-patchwave-cost',
  delta: 'automated-story-delta',
  savingsBreakdown: 'automated-story-savings-breakdown',
  shareSlider: 'automated-story-share-slider',
  waitlistCta: 'automated-story-waitlist-cta',
} as const;

const SHARE_MIN = 50;
const SHARE_MAX = 80;
const SHARE_STEP = 5;
const SHARE_DEFAULT = 65;
const SHARE_MID = (SHARE_MIN + SHARE_MAX) / 2;
const SHARE_STOPS = Array.from(
  { length: (SHARE_MAX - SHARE_MIN) / SHARE_STEP + 1 },
  (_, i) => SHARE_MIN + i * SHARE_STEP,
);

export function AutomatedStory() {
  const { derived } = useAssumptions();
  const formatAmount = useFormatAmount();
  const analytics = useAnalytics();
  const [sharePct, setSharePct] = useState(SHARE_DEFAULT);

  const today = { hours: derived.annualHours, usd: derived.annualCostUsd };
  const share = sharePct / 100;
  const autoMerged = part(today, share);
  const accelerated = part(today, (1 - share) * ASSUMED_REVIEW_SPEEDUP);
  const savings = { hours: autoMerged.hours + accelerated.hours, usd: autoMerged.usd + accelerated.usd };

  return (
    <section data-testid={automatedStoryTestIds.section} className="border-foreground mt-20 border-t pt-10">
      <div className="text-muted-foreground text-xs font-medium tracking-[0.16em] uppercase">
        If this were automated
      </div>
      <h2 className="text-foreground mt-2 text-3xl leading-tight font-medium tracking-tight sm:text-4xl">
        Today vs. with PatchWave auto-merge
      </h2>

      <p className="text-foreground mt-5 text-base leading-relaxed">
        PatchWave reviews each update, merges the ones it can clear safely, and sends the rest to a human with its
        analysis attached. Here's how much engineering time your team would get back.
      </p>

      <div className="mt-6 grid grid-cols-1 items-stretch gap-4 sm:grid-cols-[1fr_auto_1fr]">
        <CompareCard testId={automatedStoryTestIds.todayCost} label="Today" value={formatAmount(today, '/yr')} />
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
          value={formatAmount(savings, '/yr')}
          detail={`${formatAmount(autoMerged)} auto-merged + ${formatAmount(accelerated)} accelerated reviews`}
          detailTestId={automatedStoryTestIds.savingsBreakdown}
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

      <p className="text-muted-foreground mt-5 text-sm leading-relaxed">
        Savings count two things: the PRs PatchWave merges outright, and half the review time on the rest. It posts its
        analysis on every PR it hands to a human, which we assume cuts that review time in half. That second part is the
        accelerated reviews in the breakdown above.
      </p>

      <p className="text-muted-foreground mt-7 text-sm leading-relaxed">
        Most Dependabot PRs arrive with no signal that the upgrade is safe. On actively maintained JavaScript projects,
        43% of security PRs never get merged. Maintainers hold back over compatibility worries, not because the bot is
        wrong
        <Citation source="mohayeji-2025" />.
      </p>

      <Button asChild className="mt-6 no-print">
        <a
          data-testid={automatedStoryTestIds.waitlistCta}
          href="https://patchwave.ai"
          onClick={() => analytics.capture('cta_clicked', { which: 'automated_story_waitlist' })}
        >
          {callToActionCopy.ctaLabel}
        </a>
      </Button>
    </section>
  );
}

function CompareCard({
  label,
  value,
  testId,
  detail,
  detailTestId,
  accent = false,
}: {
  label: string;
  value: string;
  testId: string;
  detail?: string;
  detailTestId?: string;
  accent?: boolean;
}) {
  return (
    <div className="border-border bg-card flex flex-col justify-center rounded-md border p-5">
      <div className="text-muted-foreground text-xs font-medium tracking-[0.14em] uppercase">{label}</div>
      <div
        data-testid={testId}
        className={`${accent ? 'text-savings' : 'text-foreground'} mt-2 text-3xl font-medium tabular-nums sm:text-4xl`}
      >
        {value}
      </div>
      {detail && (
        <div data-testid={detailTestId} className="text-muted-foreground mt-2 text-xs">
          {detail}
        </div>
      )}
    </div>
  );
}

// Round each part here so the savings headline (their sum) always equals the breakdown the
// card displays. Formatters round again at display time, so summing unrounded parts could
// render a headline one off from its visible components.
function part(amount: Amount, rate: number): Amount {
  return { hours: Math.round(amount.hours * rate), usd: Math.round(amount.usd * rate) };
}
