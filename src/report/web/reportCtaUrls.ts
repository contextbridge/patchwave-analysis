const REPORT_QUERY = 'utm_source=patchwave-analysis&utm_medium=report';

export const reportCtaUrls = {
  verdict: `https://patchwave.ai/?${REPORT_QUERY}&utm_content=verdict`,
  automation: `https://patchwave.ai/?${REPORT_QUERY}&utm_content=automation`,
  final: `https://patchwave.ai/?${REPORT_QUERY}&utm_content=final-cta`,
} as const;
