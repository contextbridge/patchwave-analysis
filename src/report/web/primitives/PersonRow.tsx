interface Props {
  login: string;
  mergedCount: number;
  reviewedCount: number;
  windowHours: number;
}

export function PersonRow({ login, mergedCount, reviewedCount, windowHours }: Props) {
  return (
    <tr className="border-border border-t">
      <td className="text-foreground px-3 py-2.5 font-mono text-sm">{login}</td>
      <td className="text-foreground px-3 py-2.5 text-right text-sm tabular-nums">
        <ActivityCount count={mergedCount} label="merged" />
        {mergedCount > 0 && reviewedCount > 0 ? <span className="text-muted-foreground">, </span> : null}
        <ActivityCount count={reviewedCount} label="reviewed" />
      </td>
      <td className="text-foreground px-3 py-2.5 text-right text-sm tabular-nums">{windowHours.toLocaleString()}</td>
    </tr>
  );
}

function ActivityCount({ count, label }: { count: number; label: string }) {
  if (count === 0) return null;
  return (
    <>
      <span className="font-semibold">{count.toLocaleString()}</span>{' '}
      <span className="text-muted-foreground font-normal">{label}</span>
    </>
  );
}
