import { useAnalytics } from '../analytics/AnalyticsContext.tsx';
import { Button } from '../components/ui/button.tsx';

export const callToActionTestIds = {
  section: 'call-to-action-section',
  cta: 'call-to-action-cta',
} as const;

export const callToActionCopy = {
  heading: 'Get on the waitlist',
  pitch:
    'PatchWave reviews each Dependabot PR, auto-merges the safe updates, and gives engineers context for the few that need judgment.',
  earlyAccess: "Early access, plus a heads-up when the public beta opens. That's all we'll email you about.",
  ctaLabel: 'Join the waitlist',
} as const;

export function CallToAction() {
  const analytics = useAnalytics();
  return (
    <section data-testid={callToActionTestIds.section} className="border-foreground mt-20 border-t pt-10 no-print">
      <h2 className="text-foreground text-3xl leading-tight font-medium tracking-tight sm:text-4xl">
        {callToActionCopy.heading}
      </h2>
      <p className="text-foreground mt-5 max-w-2xl leading-relaxed">{callToActionCopy.pitch}</p>
      <p className="text-muted-foreground mt-3 max-w-2xl text-sm leading-relaxed">{callToActionCopy.earlyAccess}</p>
      <Button asChild className="mt-6">
        <a
          data-testid={callToActionTestIds.cta}
          href="https://patchwave.ai"
          onClick={() => analytics.capture('cta_clicked', { which: 'call_to_action_primary' })}
        >
          {callToActionCopy.ctaLabel}
        </a>
      </Button>
    </section>
  );
}
