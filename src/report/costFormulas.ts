// Pure cost math shared between the server-side aggregator and the client-side
// React app. No Temporal, no Bun globals, no React — keep this module dependency-free
// so it bundles cleanly into both targets.

export const ASSUMED_HOURLY_RATE_USD = 200;
export const ASSUMED_MIN_PER_PR = 12;

export const AUTO_MERGE_SCENARIO_RATES = [0.5, 0.6, 0.7, 0.8] as const;

const DAYS_PER_MONTH = 365 / 12;

export function windowCostFor(count: number, minutesPerAction: number, hourlyRateUsd: number): number {
  return Math.round(((count * minutesPerAction) / 60) * hourlyRateUsd);
}

export function monthlyFromWindow(windowCostUsd: number, windowDays: number): number {
  return Math.round((windowCostUsd * DAYS_PER_MONTH) / Math.max(1, windowDays));
}

export function annualizeWindow(windowCostUsd: number, windowDays: number): number {
  return Math.round((windowCostUsd * 365) / Math.max(1, windowDays));
}

export interface SavingsScenario {
  autoMergeRate: number;
  monthlySavingsUsd: number;
  annualSavingsUsd: number;
}

export interface CostAssumptions {
  hourlyRateUsd: number;
  minutesPerPr: number;
}

export interface DerivedCostEstimate {
  windowCostUsd: number;
  monthlyCostUsd: number;
  annualCostUsd: number;
  savingsScenarios: SavingsScenario[];
}

export interface CountedPerson {
  login: string;
  count: number;
}

export interface DerivedPersonCost extends CountedPerson {
  windowCostUsd: number;
  annualCostUsd: number;
}

export function savingsScenariosFor(monthlyCostUsd: number): SavingsScenario[] {
  return AUTO_MERGE_SCENARIO_RATES.map((autoMergeRate) => {
    const monthlySavingsUsd = Math.round(monthlyCostUsd * autoMergeRate);
    return {
      autoMergeRate,
      monthlySavingsUsd,
      annualSavingsUsd: monthlySavingsUsd * 12,
    };
  });
}

export function deriveCostEstimate(
  count: number,
  windowDays: number,
  assumptions: CostAssumptions,
): DerivedCostEstimate {
  const windowCostUsd = windowCostFor(count, assumptions.minutesPerPr, assumptions.hourlyRateUsd);
  const monthlyCostUsd = monthlyFromWindow(windowCostUsd, windowDays);
  return {
    windowCostUsd,
    monthlyCostUsd,
    annualCostUsd: monthlyCostUsd * 12,
    savingsScenarios: savingsScenariosFor(monthlyCostUsd),
  };
}

export function derivePersonCosts(
  people: readonly CountedPerson[],
  windowDays: number,
  minutesPerAction: number,
  hourlyRateUsd: number,
): DerivedPersonCost[] {
  return people.map(({ login, count }) => {
    const windowCostUsd = windowCostFor(count, minutesPerAction, hourlyRateUsd);
    return {
      login,
      count,
      windowCostUsd,
      annualCostUsd: annualizeWindow(windowCostUsd, windowDays),
    };
  });
}
