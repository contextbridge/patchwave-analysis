export function welcomeBannerTitle(): string {
  return 'patchwave-analysis';
}

export function welcomeBannerBody(): string {
  return [
    "I'll scan a GitHub org and hand you back an executive summary of how",
    'Dependabot is doing there: coverage, PR backlog, CVE exposure, the',
    'stalled PRs no-one looks at, and the engineer-hours leaking into bumps.',
    '',
    'The scan reads from api.github.com. Nothing leaves your machine until',
    "the end, when I'll ask if you'd like to share the report back.",
  ].join('\n');
}
