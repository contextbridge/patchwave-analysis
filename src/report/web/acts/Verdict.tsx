import type { ReactNode } from 'react';
import { Button } from '../components/ui/button.tsx';
import { useEmbeddedData } from '../data/EmbeddedDataContext.tsx';
import { useFormatAmount } from '../format/amount.ts';
import { useAssumptions } from '../hooks/useAssumptions.tsx';
import { type DisplayUnit, useDisplayUnit } from '../hooks/useDisplayUnit.tsx';
import type { IconName } from '../pixel/icons.ts';
import { Container } from '../primitives/Container.tsx';
import { PixelIcon } from '../primitives/PixelIcon.tsx';
import { PixelTile } from '../primitives/PixelTile.tsx';
import { automatedStorySectionId } from './AutomatedStory.tsx';
import { costStorySectionId } from './CostStory.tsx';

export const verdictTestIds = {
  section: 'verdict-section',
  annualCost: 'verdict-annual-cost',
  primaryCta: 'verdict-primary-cta',
  problemStats: 'verdict-problem-stats',
} as const;

export const verdictCopy = {
  costLeadIn: (unit: DisplayUnit) => `Your engineering team spends this much${unit === 'hours' ? ' time' : ''}`,
  costTrailer: 'triaging, reviewing, and merging Dependabot PRs',
  calculationLink: 'How we calculated this',
  openUpdates: (count: number, avgAgeDays: number | null) =>
    `${count === 1 ? 'Dependabot update is' : 'Dependabot updates are'} still open${
      avgAgeDays === null ? '' : `, ${avgAgeDays} ${avgAgeDays === 1 ? 'day' : 'days'} on average`
    }. Until ${count === 1 ? 'it merges, that dependency stays' : 'they merge, those dependencies stay'} out of date.`,
  openAlerts: (count: number) =>
    count === 1 ? 'known vulnerability is still unpatched' : 'known vulnerabilities are still unpatched',
  primaryCta: 'See how PatchWave helps',
} as const;

export function Verdict() {
  const { derived } = useAssumptions();
  const { unit } = useDisplayUnit();
  const formatAmount = useFormatAmount();
  const { prBacklog, cve } = useEmbeddedData();
  const { openCount, openAvgAgeDays } = prBacklog;
  const showAlerts = cve.status === 'ok' && cve.totalOpenAlerts > 0;

  return (
    <section
      data-testid={verdictTestIds.section}
      aria-labelledby="verdict-heading"
      className="bg-brand-violet-night text-brand-white print-plain"
    >
      <Container className="pt-12 pb-16 sm:pt-16 sm:pb-20">
        <div className="grid content-start justify-items-start gap-6">
          <p className="m-0 max-w-2xl text-lg leading-snug text-balance sm:text-xl">
            {verdictCopy.costLeadIn(unit)} {verdictCopy.costTrailer}
          </p>
          <h1
            id="verdict-heading"
            data-testid={verdictTestIds.annualCost}
            className="m-0 text-6xl leading-none font-bold tabular-nums pixel-text-shadow sm:text-7xl"
          >
            ~{formatAmount({ hours: derived.annualHours, usd: derived.annualCostUsd })}
            <span className="text-brand-butter text-3xl font-bold sm:text-4xl">/year</span>
          </h1>

          <a
            href={`#${costStorySectionId}`}
            className="text-brand-violet-pale hover:text-brand-white -mt-2 text-sm underline underline-offset-4 no-print"
          >
            {verdictCopy.calculationLink}
          </a>

          {(openCount > 0 || showAlerts) && (
            <ul data-testid={verdictTestIds.problemStats} className="m-0 mt-2 grid max-w-2xl list-none gap-4 p-0">
              {openCount > 0 && (
                <ProblemLine icon="pullRequest">
                  <strong className="text-brand-butter">{openCount.toLocaleString()}</strong>{' '}
                  {verdictCopy.openUpdates(openCount, openAvgAgeDays)}
                </ProblemLine>
              )}
              {showAlerts && (
                <ProblemLine icon="shield">
                  <strong className="text-brand-butter">{cve.totalOpenAlerts.toLocaleString()}</strong>{' '}
                  {verdictCopy.openAlerts(cve.totalOpenAlerts)}
                  <SeveritySummary critical={cve.bySeverity.critical} high={cve.bySeverity.high} />.
                </ProblemLine>
              )}
            </ul>
          )}

          <div className="mt-2 flex flex-wrap items-center gap-x-6 gap-y-4 no-print">
            <Button asChild variant="sun" cursor>
              <a data-testid={verdictTestIds.primaryCta} href={`#${automatedStorySectionId}`}>
                {verdictCopy.primaryCta}
              </a>
            </Button>
          </div>
        </div>
      </Container>
    </section>
  );
}

function ProblemLine({ icon, children }: { icon: IconName; children: ReactNode }) {
  return (
    <li className="flex items-center gap-4 text-lg leading-snug sm:text-xl">
      <PixelTile tone="violet" size="icon">
        <PixelIcon icon={icon} />
      </PixelTile>
      <span>{children}</span>
    </li>
  );
}

function SeveritySummary({ critical, high }: { critical: number; high: number }) {
  if (critical === 0 && high === 0) return null;
  return (
    <>
      , including{' '}
      {critical > 0 && (
        <span className="bg-severity-critical text-brand-white rounded px-1.5 font-bold whitespace-nowrap">
          {critical} critical
        </span>
      )}
      {critical > 0 && high > 0 && ' and '}
      {high > 0 && `${high} high`}
    </>
  );
}
