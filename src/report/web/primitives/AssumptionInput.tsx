import { useAnalytics } from '../analytics/AnalyticsContext.tsx';
import { assumptionFields } from '../assumptionFields.ts';
import { Button } from '../components/ui/button.tsx';
import { useAssumptions } from '../hooks/useAssumptions.tsx';
import { NumberStepper } from './NumberStepper.tsx';

export const assumptionInputTestIds = {
  container: 'assumption-input-container',
  hourlyRateUsd: 'assumption-input-hourly-rate-usd',
  minutesPerPr: 'assumption-input-minutes-per-pr',
  displayTime: 'assumption-input-display-time',
  displayCost: 'assumption-input-display-cost',
  reset: 'assumption-input-reset',
} as const;

export function AssumptionInput() {
  const { assumptions, displayMode, setDisplayMode, setHourlyRate, setMinutesPerPr, reset } = useAssumptions();
  const analytics = useAnalytics();
  return (
    <div
      data-testid={assumptionInputTestIds.container}
      className="border-border bg-muted flex w-full flex-wrap items-end gap-4 rounded-md border p-4"
    >
      <div className="flex flex-col gap-2" role="group" aria-labelledby="savings-display-label">
        <span
          id="savings-display-label"
          className="text-muted-foreground text-xs font-medium tracking-[0.14em] uppercase"
        >
          Show cost as
        </span>
        <div className="border-border bg-background grid h-10 w-40 grid-cols-2 items-stretch overflow-hidden rounded-md border">
          <Button
            data-testid={assumptionInputTestIds.displayTime}
            type="button"
            size="xs"
            variant={displayMode === 'time' ? 'default' : 'ghost'}
            className="h-10 w-full rounded-none px-4"
            onClick={() => {
              setDisplayMode('time');
              analytics.capture('assumption_changed', { field: 'savings_display', value: 'time' });
            }}
          >
            Hours
          </Button>
          <Button
            data-testid={assumptionInputTestIds.displayCost}
            type="button"
            size="xs"
            variant={displayMode === 'cost' ? 'default' : 'ghost'}
            className="h-10 w-full rounded-none px-4"
            onClick={() => {
              setDisplayMode('cost');
              analytics.capture('assumption_changed', { field: 'savings_display', value: 'cost' });
            }}
          >
            $
          </Button>
        </div>
      </div>
      <NumberStepper
        testId={assumptionInputTestIds.minutesPerPr}
        value={assumptions.minutesPerPr}
        onChange={setMinutesPerPr}
        onCommit={(value) => analytics.capture('assumption_changed', { field: 'minutes_per_pr', value })}
        {...assumptionFields.minutesPerPr}
      />
      {displayMode === 'cost' ? (
        <NumberStepper
          testId={assumptionInputTestIds.hourlyRateUsd}
          value={assumptions.hourlyRateUsd}
          onChange={setHourlyRate}
          onCommit={(value) => analytics.capture('assumption_changed', { field: 'hourly_rate_usd', value })}
          {...assumptionFields.hourlyRateUsd}
        />
      ) : null}
      <Button
        data-testid={assumptionInputTestIds.reset}
        type="button"
        variant="link"
        onClick={() => {
          reset();
          analytics.capture('assumptions_reset');
        }}
        className="text-muted-foreground hover:text-foreground h-10 p-0 text-xs no-print"
      >
        reset
      </Button>
    </div>
  );
}
