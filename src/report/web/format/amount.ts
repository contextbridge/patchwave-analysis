import { useCallback } from 'react';
import { type DisplayUnit, useDisplayUnit } from '../hooks/useDisplayUnit.tsx';
import { fmtHours } from './hours.ts';
import { fmtUsd } from './money.ts';

// A quantity of dependency toil the report can show either as engineer-hours or as
// dollars. Holding both lets a single formatter pick the active unit instead of every
// call site branching on it.
export interface Amount {
  hours: number;
  usd: number;
}

export function formatAmount(unit: DisplayUnit, { hours, usd }: Amount, suffix = ''): string {
  return `${unit === 'hours' ? fmtHours(hours) : fmtUsd(usd)}${suffix}`;
}

export function useFormatAmount(): (amount: Amount, suffix?: string) => string {
  const { unit } = useDisplayUnit();
  return useCallback((amount: Amount, suffix?: string) => formatAmount(unit, amount, suffix), [unit]);
}
