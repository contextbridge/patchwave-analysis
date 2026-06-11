// Pure cost math shared between the server-side aggregator and the client-side
// React app. No Temporal, no Bun globals, no React — keep this module dependency-free
// so it bundles cleanly into both targets.

export const ASSUMED_HOURLY_RATE_USD = 200;
export const ASSUMED_MIN_PER_PR = 12;

const DAYS_PER_MONTH = 365 / 12;

function windowCostFor(count: number, minutesPerAction: number, hourlyRateUsd: number): number {
  return Math.round(((count * minutesPerAction) / 60) * hourlyRateUsd);
}

function monthlyFromWindow(windowCostUsd: number, windowDays: number): number {
  return Math.round((windowCostUsd * DAYS_PER_MONTH) / Math.max(1, windowDays));
}

function annualizeWindow(windowCostUsd: number, windowDays: number): number {
  return Math.round((windowCostUsd * 365) / Math.max(1, windowDays));
}

interface CostAssumptions {
  hourlyRateUsd: number;
  minutesPerPr: number;
}

interface DerivedCostEstimate {
  windowCostUsd: number;
  monthlyCostUsd: number;
  annualCostUsd: number;
}

interface CountedPerson {
  login: string;
  count: number;
}

interface DerivedPersonCost extends CountedPerson {
  windowCostUsd: number;
  annualCostUsd: number;
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

export interface DerivedHoursEstimate {
  windowHours: number;
  monthlyHours: number;
  annualHours: number;
}

// Hours stay as unrounded floats — rounding happens once at format time. Rounding at each
// step (as the USD path does) distorts small values: 32.4 -> 32 -> x4.06 ~ 130, not 131.
export function deriveHoursEstimate(count: number, windowDays: number, minutesPerPr: number): DerivedHoursEstimate {
  const windowHours = windowHoursFor(count, minutesPerPr);
  return {
    windowHours,
    monthlyHours: (windowHours * DAYS_PER_MONTH) / Math.max(1, windowDays),
    annualHours: annualizeHours(windowHours, windowDays),
  };
}

export interface DerivedPersonHours {
  windowHours: number;
  annualHours: number;
}

export function derivePersonHours(count: number, windowDays: number, minutesPerPr: number): DerivedPersonHours {
  const windowHours = windowHoursFor(count, minutesPerPr);
  return {
    windowHours,
    annualHours: annualizeHours(windowHours, windowDays),
  };
}

function windowHoursFor(count: number, minutesPerAction: number): number {
  return (count * minutesPerAction) / 60;
}

function annualizeHours(windowHours: number, windowDays: number): number {
  return (windowHours * 365) / Math.max(1, windowDays);
}
