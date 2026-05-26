import { Minus, Plus } from 'lucide-react';
import { Button } from '../components/ui/button.tsx';
import { Input } from '../components/ui/input.tsx';
import { cn } from '../lib/utils.ts';

type ValueUpdate = number | ((prev: number) => number);

interface Props {
  label: string;
  value: number;
  onChange: (next: ValueUpdate) => void;
  min: number;
  max: number;
  step: number;
  prefix?: string;
  suffix?: string;
  testId: string;
  decrementTestId?: string;
  incrementTestId?: string;
  onCommit?: (n: number) => void;
}

// shadcn Button + Input composed into a stepper (neither shadcn nor the shared
// @contextbridge/ui ship one). Steps go through a functional update so back-to-back
// clicks accumulate; the caller clamps, so out-of-range input is safe.
export function NumberStepper({
  label,
  value,
  onChange,
  min,
  max,
  step,
  prefix,
  suffix,
  testId,
  decrementTestId,
  incrementTestId,
  onCommit,
}: Props) {
  const lower = label.toLowerCase();
  const commit = (n: number) => onCommit?.(Math.max(min, Math.min(max, n)));
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-muted-foreground text-xs font-medium tracking-[0.14em] uppercase">{label}</span>
      <div className="flex items-center gap-1.5">
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label={`Decrease ${lower}`}
          disabled={value <= min}
          onClick={() => {
            onChange((prev) => prev - step);
            commit(value - step);
          }}
          data-testid={decrementTestId}
        >
          <Minus />
        </Button>
        <div className="relative">
          {prefix && (
            <span className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm">
              {prefix}
            </span>
          )}
          <Input
            data-testid={testId}
            inputMode="numeric"
            aria-label={label}
            value={value}
            onChange={(e) => onChange(Number(e.target.value.replace(/[^0-9]/g, '')))}
            onBlur={(e) => commit(Number(e.target.value.replace(/[^0-9]/g, '')))}
            className={cn('w-28 text-center tabular-nums', prefix && 'pl-7', suffix && 'pr-9')}
          />
          {suffix && (
            <span className="text-muted-foreground pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-sm">
              {suffix}
            </span>
          )}
        </div>
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label={`Increase ${lower}`}
          disabled={value >= max}
          onClick={() => {
            onChange((prev) => prev + step);
            commit(value + step);
          }}
          data-testid={incrementTestId}
        >
          <Plus />
        </Button>
      </div>
    </div>
  );
}
