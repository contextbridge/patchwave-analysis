interface Bar {
  label: string;
  value: number;
}

interface Props {
  data: Bar[];
  emptyLabel?: string;
}

export function BarChart({ data, emptyLabel = 'No data.' }: Props) {
  const max = data.reduce((m, d) => Math.max(m, d.value), 0);
  if (max === 0) {
    return <div className="text-muted-foreground text-sm">{emptyLabel}</div>;
  }
  return (
    <div className="space-y-2.5">
      {data.map((d) => {
        const pct = (d.value / max) * 100;
        return (
          <div key={d.label} className="grid grid-cols-[8rem_1fr_3rem] items-center gap-3 text-sm">
            <span className="text-foreground">{d.label}</span>
            <span className="bg-muted relative h-4 rounded">
              <span
                className="bg-foreground absolute inset-y-0 left-0 rounded"
                style={{ width: `${pct}%` }}
                aria-hidden
              />
            </span>
            <span className="text-foreground text-right font-semibold tabular-nums">{d.value}</span>
          </div>
        );
      })}
    </div>
  );
}
