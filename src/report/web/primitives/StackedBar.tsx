interface Props {
  critical: number;
  high: number;
  medium: number;
  low: number;
}

const SEGMENTS = [
  { key: 'critical', label: 'Critical', cssVar: 'var(--red)' },
  { key: 'high', label: 'High', cssVar: 'var(--tangerine)' },
  { key: 'medium', label: 'Medium', cssVar: 'var(--color-amber-600)' },
  { key: 'low', label: 'Low', cssVar: 'var(--color-neutral-400)' },
] as const;

export function StackedBar({ critical, high, medium, low }: Props) {
  const total = critical + high + medium + low;
  if (total === 0) {
    return <div className="text-muted-foreground text-sm">No open alerts.</div>;
  }
  const counts = { critical, high, medium, low };
  return (
    <div className="space-y-3">
      <div className="bg-muted flex h-3.5 overflow-hidden rounded-full">
        {SEGMENTS.map((s) => {
          const v = counts[s.key];
          if (v === 0) return null;
          return (
            <div
              key={s.key}
              style={{ width: `${(v / total) * 100}%`, backgroundColor: s.cssVar }}
              title={`${s.label}: ${v}`}
            />
          );
        })}
      </div>
      <div className="text-foreground flex flex-wrap gap-x-5 gap-y-1.5 text-xs">
        {SEGMENTS.map((s) => (
          <span key={s.key} className="inline-flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: s.cssVar }} aria-hidden />
            <span className="font-semibold tabular-nums">{counts[s.key]}</span>
            <span className="text-muted-foreground">{s.label}</span>
          </span>
        ))}
      </div>
    </div>
  );
}
