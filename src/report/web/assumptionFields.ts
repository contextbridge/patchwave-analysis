// Single source of truth for the user-adjustable cost assumptions: the labels,
// affixes, and editable bounds the UI exposes. The runtime defaults live with the
// shared math in `../costFormulas.ts` and reach the report via the embedded data;
// this module owns only what the input control and its clamp need.

export interface AssumptionField {
  label: string;
  prefix?: string;
  suffix?: string;
  min: number;
  max: number;
  step: number;
}

export const assumptionFields = {
  hourlyRateUsd: { label: 'Loaded hourly rate', prefix: '$', suffix: '/hr', min: 1, max: 1000, step: 5 },
  minutesPerPr: { label: 'Minutes per PR', min: 1, max: 240, step: 1 },
} as const satisfies Record<string, AssumptionField>;
