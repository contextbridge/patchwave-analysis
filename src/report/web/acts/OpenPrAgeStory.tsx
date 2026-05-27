import { useEmbeddedData } from '../data/EmbeddedDataContext.tsx';
import { fmtDaysShort } from '../format/days.ts';
import { Citation } from '../primitives/Citation.tsx';

export const openPrAgeStoryTestIds = {
  section: 'open-pr-age-story-section',
  breakdown: 'open-pr-age-story-breakdown',
} as const;

export const openPrAgeStoryCopy = {
  eyebrow: 'Open PR age',
  heading: 'The backlog is getting stale',
  emptyHeading: 'No open Dependabot PR backlog',
} as const;

export function OpenPrAgeStory() {
  const { prBacklog: pr } = useEmbeddedData();
  const hasOpenPrs = pr.openCount > 0;

  return (
    <section data-testid={openPrAgeStoryTestIds.section} className="border-foreground mt-20 border-t pt-10">
      <div className="text-muted-foreground text-xs font-medium tracking-[0.16em] uppercase">
        {openPrAgeStoryCopy.eyebrow}
      </div>
      <h2 className="text-foreground mt-2 text-3xl leading-tight font-medium tracking-tight sm:text-4xl">
        {hasOpenPrs ? openPrAgeStoryCopy.heading : openPrAgeStoryCopy.emptyHeading}
      </h2>

      <p className="text-foreground mt-5 text-base leading-relaxed">
        {hasOpenPrs ? (
          <>
            Volume is trending up, not down. GitHub-published CVEs rose 476% year-to-date in 2026
            <span className="whitespace-nowrap">
              <Citation source="vulncheck-2026" />,
            </span>{' '}
            and every new CVE in your stack eventually becomes a Dependabot PR.
          </>
        ) : (
          'You have no open Dependabot PRs right now. Keep security updates enabled so new CVE-driven updates keep flowing into this queue.'
        )}
      </p>

      {hasOpenPrs && pr.openAvgAgeDays !== null && (
        <div className="divide-border mt-6 grid max-w-md grid-cols-2 divide-x">
          <BacklogStat className="pr-6" value={pr.openCount.toLocaleString()} label="still open" />
          <BacklogStat
            className="pl-6"
            value={`${pr.openAvgAgeDays} ${pr.openAvgAgeDays === 1 ? 'day' : 'days'}`}
            label="average age"
          />
        </div>
      )}

      <div data-testid={openPrAgeStoryTestIds.breakdown} className="mt-6">
        {!hasOpenPrs ? (
          <div className="border-border text-muted-foreground rounded-md border border-dashed px-4 py-6 text-sm">
            You have no open Dependabot PRs right now.
          </div>
        ) : (
          <div className="space-y-3">
            {pr.openAgeBuckets.map((bucket) => (
              <AgeBucketRow key={bucket.label} label={bucket.label} count={bucket.count} total={pr.openCount} />
            ))}
            <p className="text-muted-foreground pt-3 text-sm leading-relaxed">
              Time-to-merge in your data: p50{' '}
              <span className="text-foreground font-semibold tabular-nums">{fmtDaysShort(pr.timeToMergeP50Days)}</span>,
              p90{' '}
              <span className="text-foreground font-semibold tabular-nums">{fmtDaysShort(pr.timeToMergeP90Days)}</span>.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}

function BacklogStat({ value, label, className }: { value: string; label: string; className?: string }) {
  return (
    <div className={className}>
      <div className="text-foreground text-3xl font-medium tabular-nums">{value}</div>
      <div className="text-muted-foreground mt-1 text-xs font-medium tracking-[0.14em] uppercase">{label}</div>
    </div>
  );
}

function AgeBucketRow({ label, count, total }: { label: string; count: number; total: number }) {
  const pct = total === 0 ? 0 : Math.round((count / total) * 100);
  return (
    <div className="grid grid-cols-[6rem_1fr_3rem] items-center gap-3 text-sm">
      <div className="text-muted-foreground tabular-nums">{label}</div>
      <div className="bg-muted h-2 overflow-hidden rounded-full">
        <div className="bg-primary h-full rounded-full" style={{ width: `${pct}%` }} />
      </div>
      <div className="text-foreground text-right font-semibold tabular-nums">{count.toLocaleString()}</div>
    </div>
  );
}
