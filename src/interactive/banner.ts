export function welcomeBannerTitle(): string {
  return 'patchwave-analysis';
}

export function welcomeBannerBody(): string {
  return [
    "I'll scan a GitHub org and hand you back an executive summary of how",
    'Dependabot is doing there: coverage, PR backlog, CVE exposure, what the',
    'manual triage is costing you in engineer-hours, and how PatchWave',
    '(patchwave.ai) can help.',
    '',
    'It reads from GitHub via the API, and you choose whether to send us your',
    'data at the end.',
  ].join('\n');
}
