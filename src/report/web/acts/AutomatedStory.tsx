import { useEmbeddedData } from '../data/EmbeddedDataContext.tsx';
import { fmtUsd } from '../format/money.ts';
import { useAssumptions } from '../hooks/useAssumptions.tsx';
import { Citation } from '../primitives/Citation.tsx';
import { SavingsBars } from '../primitives/SavingsBars.tsx';

export function AutomatedStory() {
  const data = useEmbeddedData();
  const { derived } = useAssumptions();

  return (
    <section className="border-foreground mt-20 border-t pt-10">
      <div className="text-muted-foreground text-xs font-medium tracking-[0.16em] uppercase">
        If this were automated
      </div>
      <h2 className="text-foreground mt-2 text-3xl leading-tight font-medium tracking-tight sm:text-4xl">
        Today vs. with code-aware auto-merge
      </h2>

      <div className="bg-foreground mt-6 grid grid-cols-1 gap-px sm:grid-cols-2">
        <div className="bg-card p-5">
          <div className="text-muted-foreground text-xs font-medium tracking-[0.14em] uppercase">Today</div>
          <div className="text-foreground mt-3 space-y-2 text-sm leading-relaxed">
            <div>
              <span className="font-semibold tabular-nums">{data.costEstimate.mergedInWindow.toLocaleString()}</span>{' '}
              PRs handled by humans over {data.meta.windowDays} days
            </div>
            <div>
              <span className="font-semibold tabular-nums">{fmtUsd(derived.annualCostUsd)}/yr</span> in engineer time
            </div>
          </div>
        </div>
        <div className="bg-card p-5">
          <div className="text-primary text-xs font-medium tracking-[0.14em] uppercase">With auto-merge</div>
          <div className="text-foreground mt-3 space-y-2 text-sm leading-relaxed">
            <div>Safe updates merge themselves, gated by your existing CI</div>
            <div>Humans only look at PRs the analysis flags as risky</div>
            <div className="text-primary font-medium">Time and cost return to the team</div>
          </div>
        </div>
      </div>

      <h3 className="text-foreground mt-12 text-sm font-semibold tracking-[0.14em] uppercase">
        Annual savings by auto-merge share
      </h3>
      <p className="text-muted-foreground mt-1.5 text-xs">Recalculates as you change the assumptions above.</p>
      <div className="mt-4">
        <SavingsBars scenarios={derived.savingsScenarios} />
      </div>

      <p className="text-muted-foreground mt-7 text-sm leading-relaxed">
        Auto-merge is only safe if the analysis understands what changed. Research found that 67% of Dependabot PRs lack
        any compatibility scoring beyond the version bump itself
        <Citation source="rombaut-2024" /> &mdash; which is why most teams default to "review every one."
      </p>

      <MidReportCta />
    </section>
  );
}

function MidReportCta() {
  return (
    <div className="border-foreground bg-card mt-10 rounded-md border-2 p-6 no-print">
      <h3 className="text-foreground text-lg font-semibold">PatchWave automates this triage</h3>
      <p className="text-foreground mt-2 text-sm leading-relaxed">
        A GitHub App that reads each Dependabot PR's actual changes, auto-merges the safe majority, and surfaces the
        rest with reasoned context so this report stops being a quarterly fire drill.
      </p>
      <a
        href="https://patchwave.ai"
        className="bg-primary text-primary-foreground mt-4 inline-flex items-center rounded-md px-4 py-2 text-sm font-medium no-underline hover:opacity-90"
      >
        Join the waitlist &rarr;
      </a>
    </div>
  );
}
