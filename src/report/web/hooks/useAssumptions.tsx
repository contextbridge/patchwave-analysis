import { type ReactNode, createContext, useCallback, useContext, useMemo, useState } from 'react';
import { ASSUMED_MIN_PER_REVIEW, deriveCostEstimate, derivePersonCosts } from '../../costFormulas.ts';
import type { EmbeddedReportData } from '../types.ts';

export interface Assumptions {
  hourlyRateUsd: number;
  minutesPerPr: number;
}

export interface DerivedCost {
  windowCostUsd: number;
  monthlyCostUsd: number;
  annualCostUsd: number;
  savingsScenarios: Array<{ autoMergeRate: number; monthlySavingsUsd: number; annualSavingsUsd: number }>;
  topMergers: Array<{ login: string; count: number; windowCostUsd: number; annualCostUsd: number }>;
  topReviewers: Array<{ login: string; count: number; windowCostUsd: number; annualCostUsd: number }>;
}

interface ContextValue {
  assumptions: Assumptions;
  setHourlyRate: (n: number) => void;
  setMinutesPerPr: (n: number) => void;
  reset: () => void;
  derived: DerivedCost;
}

const Ctx = createContext<ContextValue | null>(null);

export function AssumptionsProvider({ data, children }: { data: EmbeddedReportData; children: ReactNode }) {
  const defaults: Assumptions = {
    hourlyRateUsd: data.costEstimate.hourlyRateUsd,
    minutesPerPr: data.costEstimate.minutesPerPr,
  };
  const [assumptions, setAssumptions] = useState<Assumptions>(defaults);
  const setHourlyRate = useCallback(
    (n: number) => setAssumptions((prev) => ({ ...prev, hourlyRateUsd: clamp(n, 1, 1000) })),
    [],
  );
  const setMinutesPerPr = useCallback(
    (n: number) => setAssumptions((prev) => ({ ...prev, minutesPerPr: clamp(n, 1, 240) })),
    [],
  );
  const reset = useCallback(() => setAssumptions(defaults), [defaults.hourlyRateUsd, defaults.minutesPerPr]);

  const derived = useMemo<DerivedCost>(() => {
    const { hourlyRateUsd, minutesPerPr } = assumptions;
    const merged = data.costEstimate.mergedInWindow;
    const windowDays = data.costEstimate.windowDays;
    const cost = deriveCostEstimate(merged, windowDays, assumptions);
    return {
      ...cost,
      topMergers: derivePersonCosts(data.people.topMergers, windowDays, minutesPerPr, hourlyRateUsd),
      topReviewers: derivePersonCosts(data.people.topReviewers, windowDays, ASSUMED_MIN_PER_REVIEW, hourlyRateUsd),
    };
  }, [assumptions, data]);

  const value: ContextValue = { assumptions, setHourlyRate, setMinutesPerPr, reset, derived };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAssumptions(): ContextValue {
  const v = useContext(Ctx);
  if (!v) {
    throw new Error('useAssumptions called outside AssumptionsProvider');
  }
  return v;
}

function clamp(n: number, min: number, max: number): number {
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, Math.round(n)));
}
