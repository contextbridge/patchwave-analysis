import { type ReactNode, createContext, useCallback, useContext, useMemo, useState } from 'react';
import { deriveCostEstimate, derivePersonCosts } from '../../costFormulas.ts';
import { assumptionFields } from '../assumptionFields.ts';
import type { EmbeddedReportData } from '../types.ts';

export interface Assumptions {
  minutesPerPr: number;
}

export interface DerivedCost {
  windowCostUsd: number;
  monthlyCostUsd: number;
  annualCostUsd: number;
  savingsScenarios: Array<{ autoMergeRate: number; monthlySavingsUsd: number; annualSavingsUsd: number }>;
  mergers: Array<{ login: string; count: number; windowCostUsd: number; annualCostUsd: number }>;
  reviewers: Array<{ login: string; count: number; windowCostUsd: number; annualCostUsd: number }>;
}

type ValueUpdate = number | ((prev: number) => number);

interface ContextValue {
  assumptions: Assumptions;
  setMinutesPerPr: (next: ValueUpdate) => void;
  reset: () => void;
  derived: DerivedCost;
}

const Ctx = createContext<ContextValue | null>(null);

export function AssumptionsProvider({ data, children }: { data: EmbeddedReportData; children: ReactNode }) {
  const defaults: Assumptions = {
    minutesPerPr: data.costEstimate.minutesPerPr,
  };
  const [assumptions, setAssumptions] = useState<Assumptions>(defaults);
  const setMinutesPerPr = useCallback(
    (next: ValueUpdate) =>
      setAssumptions((prev) => ({
        ...prev,
        minutesPerPr: clamp(
          resolve(next, prev.minutesPerPr),
          assumptionFields.minutesPerPr.min,
          assumptionFields.minutesPerPr.max,
        ),
      })),
    [],
  );
  const reset = useCallback(() => setAssumptions(defaults), [defaults.minutesPerPr]);

  const derived = useMemo<DerivedCost>(() => {
    const { minutesPerPr } = assumptions;
    const hourlyRateUsd = data.costEstimate.hourlyRateUsd;
    const totalActions = data.costEstimate.humanMergeCount + data.costEstimate.humanReviewCount;
    const windowDays = data.costEstimate.windowDays;
    const cost = deriveCostEstimate(totalActions, windowDays, { minutesPerPr, hourlyRateUsd });
    return {
      ...cost,
      mergers: derivePersonCosts(data.people.mergers, windowDays, minutesPerPr, hourlyRateUsd),
      reviewers: derivePersonCosts(data.people.reviewers, windowDays, minutesPerPr, hourlyRateUsd),
    };
  }, [assumptions, data]);

  const value: ContextValue = { assumptions, setMinutesPerPr, reset, derived };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAssumptions(): ContextValue {
  const v = useContext(Ctx);
  if (!v) {
    throw new Error('useAssumptions called outside AssumptionsProvider');
  }
  return v;
}

function resolve(next: ValueUpdate, prev: number): number {
  return typeof next === 'function' ? next(prev) : next;
}

function clamp(n: number, min: number, max: number): number {
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, Math.round(n)));
}
