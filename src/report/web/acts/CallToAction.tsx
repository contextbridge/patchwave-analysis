import { Button } from '../components/ui/button.tsx';
import { createOceanScene } from '../pixel/oceanScene.ts';
import { PixelCanvas } from '../primitives/PixelCanvas.tsx';
import { reportCtaUrls } from '../reportCtaUrls.ts';

export const callToActionTestIds = {
  section: 'call-to-action-section',
  cta: 'call-to-action-cta',
  howItWorks: 'call-to-action-how-it-works',
} as const;

export const callToActionCopy = {
  heading: 'Wave goodbye to (most) dependency update work.',
  pitch: 'PatchWave is a GitHub app that automatically analyzes, fixes and merges your Dependabot PRs.',
  trialTerms: 'Free for 30 days, up to 100 PRs.',
  ctaLabel: 'Join the public beta',
  ctaNote: 'No credit card. The 30 days start when you install the GitHub App.',
  howItWorksLabel: 'See how it works',
} as const;

export function CallToAction() {
  return (
    <section
      data-testid={callToActionTestIds.section}
      aria-labelledby="call-to-action-heading"
      className="pixel-sky text-brand-white relative isolate overflow-hidden no-print [--ocean:120px] lg:[--ocean:160px]"
    >
      <PixelCanvas scene={createOceanScene} />
      {/* Like a game's title screen: the copy on the plain night sky, clear of the sunset bands (37 art pixels at 4px). */}
      <div className="mx-auto grid max-w-3xl justify-items-center gap-6 px-6 pt-16 pb-[calc(var(--ocean)+148px+48px)] text-center lg:pt-24">
        <h2
          id="call-to-action-heading"
          className="m-0 text-4xl leading-tight font-bold text-balance pixel-text-shadow sm:text-5xl"
        >
          {callToActionCopy.heading}
        </h2>
        <p className="m-0 max-w-2xl text-lg leading-relaxed text-balance sm:text-xl">{callToActionCopy.pitch}</p>
        <p className="text-brand-butter m-0 text-2xl leading-tight font-bold text-balance">
          {callToActionCopy.trialTerms}
        </p>
        <div className="mt-4 grid justify-items-center gap-4">
          <Button asChild variant="sun" cursor>
            <a data-testid={callToActionTestIds.cta} href={reportCtaUrls.final}>
              {callToActionCopy.ctaLabel}
            </a>
          </Button>
          <p className="text-brand-white/75 m-0 text-sm">{callToActionCopy.ctaNote}</p>
          <a
            data-testid={callToActionTestIds.howItWorks}
            href={reportCtaUrls.howItWorks}
            className="text-brand-white hover:text-brand-sun mt-2 font-mono text-sm font-bold tracking-wider uppercase underline underline-offset-4"
          >
            {callToActionCopy.howItWorksLabel}
          </a>
        </div>
      </div>
    </section>
  );
}
