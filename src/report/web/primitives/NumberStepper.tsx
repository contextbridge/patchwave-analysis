import { Minus, Plus } from 'lucide-react';
import { useEffect, useState } from 'react';
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
  const [draft, setDraft] = useState(String(value));
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    if (!isEditing) setDraft(String(value));
  }, [isEditing, value]);

  const lower = label.toLowerCase();
  const normalize = (n: number) => Math.max(min, Math.min(max, Math.round(n)));
  const commit = (n: number) => {
    const normalized = normalize(n);
    onChange(normalized);
    onCommit?.(normalized);
    setDraft(String(normalized));
  };
  const commitDraft = () => {
    const parsed = Number(draft);
    commit(Number.isFinite(parsed) ? parsed : value);
    setIsEditing(false);
  };
  const displayValue = isEditing ? draft : String(value);
  return (
    <div className="flex flex-col gap-2">
      <span className="text-muted-foreground text-xs font-medium tracking-[0.14em] uppercase">{label}</span>
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label={`Decrease ${lower}`}
          disabled={value <= min}
          onClick={() => {
            const next = normalize(value - step);
            onChange((prev) => prev - step);
            onCommit?.(next);
            setDraft(String(next));
          }}
          className="size-10"
          data-testid={decrementTestId}
        >
          <Minus />
        </Button>
        <div className="relative">
          {prefix && (
            <span className="text-muted-foreground pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-sm">
              {prefix}
            </span>
          )}
          <Input
            data-testid={testId}
            inputMode="numeric"
            aria-label={label}
            value={displayValue}
            onFocus={() => setIsEditing(true)}
            onChange={(e) => {
              const next = e.target.value.replace(/[^0-9]/g, '');
              setDraft(next);
              const parsed = Number(next);
              if (next !== '' && Number.isFinite(parsed)) onChange(parsed);
            }}
            onBlur={commitDraft}
            onKeyDown={(e) => {
              if (e.key === 'Enter') e.currentTarget.blur();
            }}
            className={cn('h-10 w-28 text-center tabular-nums', prefix && 'pl-8', suffix && 'pr-10')}
          />
          {suffix && (
            <span className="text-muted-foreground pointer-events-none absolute top-1/2 right-4 -translate-y-1/2 text-sm">
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
            const next = normalize(value + step);
            onChange((prev) => prev + step);
            onCommit?.(next);
            setDraft(String(next));
          }}
          className="size-10"
          data-testid={incrementTestId}
        >
          <Plus />
        </Button>
      </div>
    </div>
  );
}
