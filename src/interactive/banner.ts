export function welcomeBannerTitle(): string {
  return 'PatchWave Dependency Checkup';
}

export function welcomeBannerBody(): string {
  return [
    "I'll scan a GitHub org and hand you back an executive summary of how",
    'Dependabot is doing there: coverage, PR backlog, CVE exposure, what the',
    'manual triage is costing you in engineer-hours, and how PatchWave',
    '(patchwave.ai) can help.',
    '',
    'The scan only reads from GitHub, and the report stays on this machine.',
  ].join('\n');
}
