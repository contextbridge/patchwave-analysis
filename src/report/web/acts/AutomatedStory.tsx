import { type CSSProperties, useState } from 'react';
import { ASSUMED_REVIEW_SPEEDUP } from '../../costFormulas.ts';
import { Button } from '../components/ui/button.tsx';
import { type Amount, useFormatAmount } from '../format/amount.ts';
import { useAssumptions } from '../hooks/useAssumptions.tsx';
import { ActHeader } from '../primitives/ActHeader.tsx';
import { Citation } from '../primitives/Citation.tsx';
import { PixelTile } from '../primitives/PixelTile.tsx';
import { Sprite } from '../primitives/Sprite.tsx';
import { Stat, StatGrid } from '../primitives/Stat.tsx';
import { reportCtaUrls } from '../reportCtaUrls.ts';

export const automatedStoryTestIds = {
  section: 'automated-story-section',
  todayCost: 'automated-story-today-cost',
  patchwaveCost: 'automated-story-patchwave-cost',
  delta: 'automated-story-delta',
  savingsBreakdown: 'automated-story-savings-breakdown',
  shareSlider: 'automated-story-share-slider',
  primaryCta: 'automated-story-primary-cta',
} as const;

export const automatedStorySectionId = 'patchwave';

export const automatedStoryCopy = {
  ctaLabel: (savings: string) => `Start saving ${savings}`,
  ctaFallbackLabel: 'Join the public beta',
  ctaNote: 'Free for 30 days. No credit card.',
} as const;

const SHARE_MIN = 50;
const SHARE_MAX = 80;
const SHARE_STEP = 5;
const SHARE_DEFAULT = 65;
const SHARE_MID = (SHARE_MIN + SHARE_MAX) / 2;

export function AutomatedStory() {
  const { derived } = useAssumptions();
  const formatAmount = useFormatAmount();
  const [sharePct, setSharePct] = useState(SHARE_DEFAULT);

  const today = { hours: derived.annualHours, usd: derived.annualCostUsd };
  const share = sharePct / 100;
  const autoMerged = part(today, share);
  const accelerated = part(today, (1 - share) * ASSUMED_REVIEW_SPEEDUP);
  const savings = { hours: autoMerged.hours + accelerated.hours, usd: autoMerged.usd + accelerated.usd };

  return (
    <section id={automatedStorySectionId} data-testid={automatedStoryTestIds.section} className="scroll-mt-24">
      <ActHeader icon="bolt" eyebrow="If this were automated">
        Today vs. with PatchWave auto-merge
      </ActHeader>

      <MeetPatch />

      <p className="text-foreground mt-5 text-base leading-relaxed">
        PatchWave analyzes each update and merges it when the analysis shows the upgrade is safe. When it isn't sure, it
        posts that analysis on the PR to speed up the human review. Here's how much engineering time your team would get
        back.
      </p>

      <div className="mt-6">
        <StatGrid columns={2}>
          <Stat valueTestId={automatedStoryTestIds.todayCost} label="Today" value={formatAmount(today, '/yr')} />
          <Stat
            valueTestId={automatedStoryTestIds.patchwaveCost}
            label="PatchWave savings"
            value={formatAmount(savings, '/yr')}
            detail={`${formatAmount(autoMerged)} from auto-merge + ${formatAmount(accelerated)} from accelerated reviews`}
            detailTestId={automatedStoryTestIds.savingsBreakdown}
            highlight
          />
        </StatGrid>
      </div>

      <div className="border-border bg-card mt-5 rounded-md border p-4 no-print">
        <div className="flex items-baseline justify-between">
          <label htmlFor="automerge-share" className="text-foreground text-sm font-medium">
            PRs auto-merged
          </label>
          <span
            data-testid={automatedStoryTestIds.delta}
            className="text-primary font-mono text-sm font-bold tabular-nums"
          >
            {sharePct}%
          </span>
        </div>
        <input
          id="automerge-share"
          data-testid={automatedStoryTestIds.shareSlider}
          type="range"
          min={SHARE_MIN}
          max={SHARE_MAX}
          step={SHARE_STEP}
          value={sharePct}
          onChange={(e) => setSharePct(Number(e.target.value))}
          style={{ '--range-fill': (sharePct - SHARE_MIN) / (SHARE_MAX - SHARE_MIN) } as CSSProperties}
          className="pixel-range mt-3 block w-full"
        />
        <div className="text-muted-foreground mt-2 flex justify-between font-mono text-xs tabular-nums">
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

      <div className="mt-7 flex flex-wrap items-center gap-x-6 gap-y-3 no-print">
        <Button asChild variant="pixel" cursor>
          <a data-testid={automatedStoryTestIds.primaryCta} href={reportCtaUrls.automation}>
            {savings.hours >= 1
              ? automatedStoryCopy.ctaLabel(formatAmount(savings, '/yr'))
              : automatedStoryCopy.ctaFallbackLabel}
          </a>
        </Button>
        <p className="text-muted-foreground m-0 text-sm">{automatedStoryCopy.ctaNote}</p>
      </div>
    </section>
  );
}

// Round each part here so the savings headline (their sum) always equals the breakdown the
// card displays. Formatters round again at display time, so summing unrounded parts could
// render a headline one off from its visible components.
function part(amount: Amount, rate: number): Amount {
  return { hours: Math.round(amount.hours * rate), usd: Math.round(amount.usd * rate) };
}

function MeetPatch() {
  return (
    <div className="mt-6 flex items-center gap-6">
      <PixelTile tone="ink" size="bust" shape="circle">
        <Sprite sprite="patchHead" scale={3} />
      </PixelTile>
      <div className="grid gap-1">
        <p className="text-foreground m-0 text-2xl font-bold">Meet Patch.</p>
        <p className="text-muted-foreground m-0 max-w-md text-lg leading-snug text-pretty">
          Patch is an agent that automatically analyzes, fixes and merges your Dependabot PRs.
        </p>
      </div>
    </div>
  );
}
