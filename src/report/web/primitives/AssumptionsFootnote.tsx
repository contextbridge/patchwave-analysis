import { useAnalytics } from '../analytics/AnalyticsContext.tsx';
import { FootnoteReference } from './FootnoteReference.tsx';

export const assumptionsFootnoteTestId = 'assumptions-footnote';
export const assumptionsFootnoteId = 'assumptions';
export const assumptionsPanelId = 'appendix-assumptions';

export function AssumptionsFootnote({ from, className }: { from: string; className?: string }) {
  const analytics = useAnalytics();
  return (
    <FootnoteReference
      id={assumptionsFootnoteId}
      title="Adjustable cost assumptions"
      body="Cost and time estimates use the hourly rate and minutes-per-PR controls in this appendix. Change those inputs to recalculate the report."
      kind="assumptions"
      className={className}
      testId={assumptionsFootnoteTestId}
      titleText="Estimated from adjustable assumptions — view and change them"
      onClick={() => analytics.capture('assumptions_revealed', { from })}
    />
  );
}
