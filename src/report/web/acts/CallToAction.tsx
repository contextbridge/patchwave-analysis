import { useAnalytics } from '../analytics/AnalyticsContext.tsx';
import { Button } from '../components/ui/button.tsx';
import { reportCtaUrls } from '../reportCtaUrls.ts';

export const callToActionTestIds = {
  section: 'call-to-action-section',
  cta: 'call-to-action-cta',
} as const;

export const callToActionCopy = {
  heading: 'See what PatchWave can do',
  pitch:
    'PatchWave reviews Dependabot PRs, automatically merges safe updates, and adds context when an engineer needs to make the call.',
  ctaLabel: 'Learn more about PatchWave',
} as const;

export function CallToAction() {
  const analytics = useAnalytics();
  return (
    <section data-testid={callToActionTestIds.section} className="border-foreground mt-20 border-t pt-10 no-print">
      <h2 className="text-foreground text-3xl leading-tight font-medium tracking-tight sm:text-4xl">
        {callToActionCopy.heading}
      </h2>
      <p className="text-foreground mt-5 max-w-2xl leading-relaxed">{callToActionCopy.pitch}</p>
      <Button asChild className="mt-6">
        <a
          data-testid={callToActionTestIds.cta}
          href={reportCtaUrls.final}
          onClick={() => analytics.capture('cta_clicked', { which: 'call_to_action_primary' })}
        >
          {callToActionCopy.ctaLabel}
        </a>
      </Button>
    </section>
  );
}
