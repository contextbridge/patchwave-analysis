export const PATCHWAVE_URL = 'https://patchwave.ai/';
export const PATCHWAVE_SIGNUP_URL = 'https://app.patchwave.ai/join';
export const INSTALL_SCRIPT_URL = 'https://patchwave.ai/analyze.sh';
export const CONTEXTBRIDGE_URL = 'https://contextbridge.ai/';
export const SOURCE_REPO_URL = 'https://github.com/contextbridge/patchwave-analysis';
export const GITHUB_NEW_TOKEN_URL = 'https://github.com/settings/tokens/new';

interface UtmTags {
  readonly medium: 'cli' | 'report';
  readonly content?: string;
}

/** Tags a link so PostHog on the destination attributes the visit to this tool. */
export function withUtm(url: string, { medium, content }: UtmTags): string {
  const tagged = new URL(url);
  tagged.searchParams.set('utm_source', 'patchwave-analysis');
  tagged.searchParams.set('utm_medium', medium);
  if (content !== undefined) tagged.searchParams.set('utm_content', content);
  return tagged.toString();
}
