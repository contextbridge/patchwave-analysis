import { useAssumptions } from '../hooks/useAssumptions.tsx';
import { AssumptionInput } from './AssumptionInput.tsx';

export const heroAssumptionsTestIds = {
  summary: 'hero-assumptions-summary',
} as const;

export function HeroAssumptions() {
  const { assumptions } = useAssumptions();
  return (
    <details className="group no-print">
      <summary
        data-testid={heroAssumptionsTestIds.summary}
        className="text-muted-foreground flex w-fit cursor-pointer items-center gap-2 text-sm select-none marker:content-none [&::-webkit-details-marker]:hidden"
      >
        <span>
          Assumes it takes{' '}
          <span className="text-foreground font-semibold tabular-nums">{assumptions.minutesPerPr} minutes</span> to
          review each PR
        </span>
        <span className="text-primary text-xs font-medium underline-offset-4 hover:underline">
          <span className="group-open:hidden">Adjust</span>
          <span className="hidden group-open:inline">Done</span>
        </span>
      </summary>
      <div className="mt-3 max-w-lg">
        <AssumptionInput />
      </div>
    </details>
  );
}
