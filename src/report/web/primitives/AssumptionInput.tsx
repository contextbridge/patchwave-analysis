import { useAnalytics } from '../analytics/AnalyticsContext.tsx';
import { assumptionFields } from '../assumptionFields.ts';
import { Button } from '../components/ui/button.tsx';
import { useAssumptions } from '../hooks/useAssumptions.tsx';
import { NumberStepper } from './NumberStepper.tsx';

export const assumptionInputTestIds = {
  container: 'assumption-input-container',
  minutesPerPr: 'assumption-input-minutes-per-pr',
  reset: 'assumption-input-reset',
} as const;

export function AssumptionInput() {
  const { assumptions, setMinutesPerPr, reset } = useAssumptions();
  const analytics = useAnalytics();
  return (
    <div
      data-testid={assumptionInputTestIds.container}
      className="border-border bg-muted flex flex-wrap items-end gap-4 rounded-md border p-4"
    >
      <NumberStepper
        testId={assumptionInputTestIds.minutesPerPr}
        value={assumptions.minutesPerPr}
        onChange={setMinutesPerPr}
        onCommit={(value) => analytics.capture('assumption_changed', { field: 'minutes_per_pr', value })}
        {...assumptionFields.minutesPerPr}
      />
      <Button
        data-testid={assumptionInputTestIds.reset}
        type="button"
        variant="link"
        onClick={() => {
          reset();
          analytics.capture('assumptions_reset');
        }}
        className="text-muted-foreground hover:text-foreground mb-1 h-auto p-0 text-xs no-print"
      >
        reset
      </Button>
    </div>
  );
}
