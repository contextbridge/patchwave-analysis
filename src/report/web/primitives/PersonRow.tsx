import { fmtUsd } from '../format/money.ts';

interface Props {
  login: string;
  count: number;
  countLabel: string;
  windowCostUsd: number;
  annualCostUsd: number;
}

export function PersonRow({ login, count, countLabel, windowCostUsd, annualCostUsd }: Props) {
  return (
    <tr className="border-border border-t">
      <td className="text-foreground px-3 py-2.5 font-mono text-sm">{login}</td>
      <td className="text-foreground px-3 py-2.5 text-right text-sm tabular-nums">
        <span className="font-semibold">{count}</span>{' '}
        <span className="text-muted-foreground font-normal">{countLabel}</span>
      </td>
      <td className="text-foreground px-3 py-2.5 text-right text-sm tabular-nums">{fmtUsd(windowCostUsd)}</td>
      <td className="text-foreground px-3 py-2.5 text-right text-sm font-semibold tabular-nums">
        {fmtUsd(annualCostUsd)}
      </td>
    </tr>
  );
}
