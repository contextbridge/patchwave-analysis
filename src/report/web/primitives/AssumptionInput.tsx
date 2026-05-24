import { useAssumptions } from '../hooks/useAssumptions.tsx';

interface Props {
  variant?: 'inline' | 'panel';
}

export const assumptionInputTestIds = {
  container: 'assumption-input-container',
  hourlyRate: 'assumption-input-hourly-rate',
  minutesPerPr: 'assumption-input-minutes-per-pr',
  reset: 'assumption-input-reset',
} as const;

export function AssumptionInput({ variant = 'inline' }: Props) {
  const { assumptions, setHourlyRate, setMinutesPerPr, reset } = useAssumptions();
  const isPanel = variant === 'panel';
  return (
    <div
      data-testid={assumptionInputTestIds.container}
      className={
        isPanel
          ? 'border-border bg-muted rounded-md border p-4'
          : 'bg-muted flex flex-wrap items-end gap-4 rounded-md px-4 py-3 text-sm'
      }
    >
      <NumberField
        testId={assumptionInputTestIds.hourlyRate}
        label="Loaded hourly rate"
        prefix="$"
        suffix="/hr"
        value={assumptions.hourlyRateUsd}
        onChange={setHourlyRate}
        min={1}
        max={1000}
        step={5}
      />
      <NumberField
        testId={assumptionInputTestIds.minutesPerPr}
        label="Minutes per PR"
        value={assumptions.minutesPerPr}
        onChange={setMinutesPerPr}
        min={1}
        max={240}
        step={1}
      />
      <button
        data-testid={assumptionInputTestIds.reset}
        type="button"
        onClick={reset}
        className="text-muted-foreground decoration-border hover:text-foreground text-xs font-medium underline underline-offset-2 no-print"
      >
        reset
      </button>
    </div>
  );
}

interface FieldProps {
  label: string;
  value: number;
  onChange: (n: number) => void;
  prefix?: string;
  suffix?: string;
  min: number;
  max: number;
  step: number;
  testId: string;
}

function NumberField({ label, value, onChange, prefix, suffix, min, max, step, testId }: FieldProps) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-muted-foreground text-xs font-medium tracking-[0.14em] uppercase">{label}</span>
      <span className="border-input bg-background focus-within:border-ring focus-within:ring-ring/40 inline-flex items-center rounded border px-2 py-1.5 text-sm focus-within:ring-2">
        {prefix && <span className="text-muted-foreground mr-1">{prefix}</span>}
        <input
          data-testid={testId}
          type="number"
          className="text-foreground w-20 bg-transparent text-right tabular-nums focus:outline-none"
          value={value}
          min={min}
          max={max}
          step={step}
          onChange={(e) => onChange(Number(e.target.value))}
        />
        {suffix && <span className="text-muted-foreground ml-1">{suffix}</span>}
      </span>
    </label>
  );
}
