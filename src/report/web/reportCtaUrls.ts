import { PATCHWAVE_SIGNUP_URL, PATCHWAVE_URL, withUtm } from '../../urls.ts';

export const reportCtaUrls = {
  automation: withUtm(PATCHWAVE_SIGNUP_URL, { medium: 'report', content: 'automation' }),
  dependabotPaused: withUtm(PATCHWAVE_SIGNUP_URL, { medium: 'report', content: 'dependabot-paused' }),
  final: withUtm(PATCHWAVE_SIGNUP_URL, { medium: 'report', content: 'final-cta' }),
  header: withUtm(PATCHWAVE_URL, { medium: 'report', content: 'header' }),
  howItWorks: withUtm(`${PATCHWAVE_URL}#how-it-works`, { medium: 'report', content: 'how-it-works' }),
} as const;
