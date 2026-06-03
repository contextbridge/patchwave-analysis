import { type ReactNode, useEffect, useState } from 'react';
import { useAnalytics } from '../analytics/AnalyticsContext.tsx';
import { assumptionFields } from '../assumptionFields.ts';
import { useEmbeddedData } from '../data/EmbeddedDataContext.tsx';
import { useAssumptions } from '../hooks/useAssumptions.tsx';

export const costReceiptTestIds = {
  container: 'cost-receipt',
  observed: 'cost-receipt-observed',
  minutes: 'cost-receipt-minutes',
  rate: 'cost-receipt-rate',
  annualize: 'cost-receipt-annualize',
} as const;

export const costReceiptCopy = {
  observedLabel: 'PRs merged',
  observedBadge: 'observed',
  minutesLabel: 'review per PR',
  minutesSuffix: 'min',
  rateLabel: 'loaded cost, 1 eng',
  annualizeLabel: 'annualize',
} as const;

export function CostReceipt() {
  const { assumptions, setHourlyRate, setMinutesPerPr } = useAssumptions();
  const { costEstimate } = useEmbeddedData();
  const analytics = useAnalytics();
  const observed = costEstimate.humanMergeCount + costEstimate.humanReviewCount;
  const { windowDays } = costEstimate;
  const annualizeMultiplier = 365 / Math.max(1, windowDays);

  return (
    <div data-testid={costReceiptTestIds.container} className="flex flex-wrap items-center gap-x-3 gap-y-3">
      <Factor
        testId={costReceiptTestIds.observed}
        value={observed.toLocaleString()}
        label={costReceiptCopy.observedLabel}
        sublabel={`last ${windowDays} days`}
        badge={costReceiptCopy.observedBadge}
      />
      <Operator>×</Operator>
      <EditableFactor
        testId={costReceiptTestIds.minutes}
        value={assumptions.minutesPerPr}
        onChange={setMinutesPerPr}
        onCommit={(value) => analytics.capture('assumption_changed', { field: 'minutes_per_pr', value })}
        ariaLabel={assumptionFields.minutesPerPr.label}
        suffix={costReceiptCopy.minutesSuffix}
        label={costReceiptCopy.minutesLabel}
        min={assumptionFields.minutesPerPr.min}
        max={assumptionFields.minutesPerPr.max}
      />
      <Operator>×</Operator>
      <EditableFactor
        testId={costReceiptTestIds.rate}
        value={assumptions.hourlyRateUsd}
        onChange={setHourlyRate}
        onCommit={(value) => analytics.capture('assumption_changed', { field: 'hourly_rate', value })}
        ariaLabel={assumptionFields.hourlyRateUsd.label}
        prefix={assumptionFields.hourlyRateUsd.prefix}
        suffix={assumptionFields.hourlyRateUsd.suffix}
        label={costReceiptCopy.rateLabel}
        min={assumptionFields.hourlyRateUsd.min}
        max={assumptionFields.hourlyRateUsd.max}
      />
      <Operator>×</Operator>
      <Factor
        testId={costReceiptTestIds.annualize}
        value={annualizeMultiplier.toFixed(2)}
        label={costReceiptCopy.annualizeLabel}
        sublabel={`365 ÷ ${windowDays} days`}
      />
    </div>
  );
}

function Operator({ children }: { children: ReactNode }) {
  return (
    <span className="text-muted-foreground self-center text-lg font-light" aria-hidden>
      {children}
    </span>
  );
}

const valueClass = 'text-foreground text-xl leading-none font-medium tabular-nums';
const labelClass = 'text-muted-foreground mt-1.5 block text-xs';

function Factor({
  testId,
  value,
  label,
  sublabel,
  badge,
}: {
  testId: string;
  value: string;
  label: string;
  sublabel?: string;
  badge?: string;
}) {
  return (
    <div data-testid={testId}>
      <span className={`block ${valueClass}`}>{value}</span>
      <span className={labelClass}>
        {label}
        {badge && (
          <span className="bg-primary/10 text-primary ml-1.5 rounded px-1 py-0.5 text-[10px] font-medium tracking-wide uppercase">
            {badge}
          </span>
        )}
      </span>
      {sublabel && <span className="text-muted-foreground/70 block text-xs">{sublabel}</span>}
    </div>
  );
}

type ValueUpdate = number | ((prev: number) => number);

function EditableFactor({
  testId,
  value,
  onChange,
  onCommit,
  ariaLabel,
  label,
  prefix,
  suffix,
  min,
  max,
}: {
  testId: string;
  value: number;
  onChange: (next: ValueUpdate) => void;
  onCommit: (n: number) => void;
  ariaLabel: string;
  label: string;
  prefix?: string;
  suffix?: string;
  min: number;
  max: number;
}) {
  const [draft, setDraft] = useState(String(value));
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    if (!isEditing) setDraft(String(value));
  }, [isEditing, value]);

  const display = isEditing ? draft : String(value);
  const clamp = (n: number) => Math.max(min, Math.min(max, Math.round(n)));
  const commit = () => {
    const parsed = Number(draft);
    const next = clamp(draft !== '' && Number.isFinite(parsed) ? parsed : value);
    onChange(next);
    onCommit(next);
    setDraft(String(next));
    setIsEditing(false);
  };

  return (
    <label className="group block cursor-text" title={`Edit ${label}`}>
      <span className={`flex items-baseline ${valueClass}`}>
        {prefix && <span>{prefix}</span>}
        <input
          data-testid={testId}
          inputMode="numeric"
          aria-label={ariaLabel}
          value={display}
          onFocus={(event) => {
            setIsEditing(true);
            event.currentTarget.select();
          }}
          onChange={(event) => {
            const next = event.target.value.replace(/[^0-9]/g, '');
            setDraft(next);
            const parsed = Number(next);
            if (next !== '' && Number.isFinite(parsed)) onChange(parsed);
          }}
          onBlur={commit}
          onKeyDown={(event) => {
            if (event.key === 'Enter') event.currentTarget.blur();
          }}
          style={{ width: `${Math.max(4, display.length + 2)}ch` }}
          className="border-primary bg-background caret-primary focus:ring-primary/25 rounded-md border px-1.5 py-0.5 text-center outline-none transition-colors focus:ring-2"
        />
        {suffix && <span className="ml-0.5">{suffix}</span>}
      </span>
      <span className={labelClass}>{label}</span>
    </label>
  );
}
