import type { ReactNode } from 'react';

type Tone = 'default' | 'critical' | 'high';

interface StatProps {
  label: string;
  value: string;
  detail?: string;
  /** Picks the cell out of its grid, as the figure the rest of the grid leads to. */
  highlight?: boolean;
  tone?: Tone;
  valueTestId?: string;
  detailTestId?: string;
}

const valueTones: Record<Tone, string> = {
  default: 'text-foreground',
  critical: 'text-severity-critical',
  high: 'text-severity-high',
};

/** A labelled figure, one cell of a StatGrid. */
export function Stat({
  label,
  value,
  detail,
  highlight = false,
  tone = 'default',
  valueTestId,
  detailTestId,
}: StatProps) {
  return (
    <div className={`${highlight ? 'bg-brand-violet-pale' : 'bg-card'} flex flex-col justify-center p-5`}>
      <div className="eyebrow text-muted-foreground">{label}</div>
      <div
        data-testid={valueTestId}
        className={`${highlight ? 'text-savings' : valueTones[tone]} mt-1.5 text-3xl font-medium tabular-nums`}
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

const columnClasses = { 2: 'sm:grid-cols-2', 3: 'sm:grid-cols-3' };

/** Stats side by side in one bordered panel, separated by hairlines. */
export function StatGrid({ columns, children }: { columns: 2 | 3; children: ReactNode }) {
  return (
    <div
      className={`bg-border border-border grid grid-cols-1 gap-px overflow-hidden rounded-lg border ${columnClasses[columns]}`}
    >
      {children}
    </div>
  );
}
