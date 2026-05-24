export const callToActionTestIds = {
  section: 'call-to-action-section',
  link: 'call-to-action-link',
} as const;

export const callToActionCopy = {
  heading: 'Get on the waitlist',
  linkLabel: 'patchwave.ai →',
} as const;

export function CallToAction() {
  return (
    <section data-testid={callToActionTestIds.section} className="border-foreground mt-20 border-t pt-10 no-print">
      <h2 className="text-foreground text-3xl leading-tight font-medium tracking-tight sm:text-4xl">
        {callToActionCopy.heading}
      </h2>
      <p className="text-foreground mt-5 max-w-xl leading-relaxed">
        Early access notifications, plus a heads-up when we open the public beta. No newsletter, no upsell email
        sequence.
      </p>
      <a
        data-testid={callToActionTestIds.link}
        href="https://patchwave.ai"
        className="bg-foreground text-background mt-6 inline-flex items-center rounded-md px-5 py-2.5 text-sm font-medium no-underline hover:opacity-90"
      >
        {callToActionCopy.linkLabel}
      </a>
    </section>
  );
}
