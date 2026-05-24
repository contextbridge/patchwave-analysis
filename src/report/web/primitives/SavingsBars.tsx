import { fmtUsd } from '../format/money.ts';

interface Scenario {
  autoMergeRate: number;
  annualSavingsUsd: number;
}

interface Props {
  scenarios: Scenario[];
}

export function SavingsBars({ scenarios }: Props) {
  const max = scenarios.reduce((m, s) => Math.max(m, s.annualSavingsUsd), 0);
  if (max === 0) {
    return <div className="text-muted-foreground text-sm">No baseline cost to project from.</div>;
  }
  return (
    <div className="space-y-3">
      {scenarios.map((s) => {
        const pct = (s.annualSavingsUsd / max) * 100;
        const label = `${Math.round(s.autoMergeRate * 100)}% auto-merged`;
        return (
          <div key={s.autoMergeRate} className="grid grid-cols-[8rem_1fr_5rem] items-center gap-3 text-sm">
            <span className="text-foreground">{label}</span>
            <span className="bg-muted relative h-5 rounded">
              <span className="bg-primary absolute inset-y-0 left-0 rounded" style={{ width: `${pct}%` }} aria-hidden />
            </span>
            <span className="text-foreground text-right font-semibold tabular-nums">{fmtUsd(s.annualSavingsUsd)}</span>
          </div>
        );
      })}
    </div>
  );
}
