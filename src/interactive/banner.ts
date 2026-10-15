export function welcomeBannerTitle(): string {
  return 'PatchWave Dependency Checkup';
}

export function welcomeBannerBody({ telemetryEnabled }: { telemetryEnabled: boolean }): string {
  const lines = [
    "I'll scan a GitHub org and hand you back an executive summary of how",
    'Dependabot is doing there: coverage, PR backlog, CVE exposure, what the',
    'manual triage is costing you in engineer-hours, and how PatchWave',
    '(patchwave.ai) can help.',
    '',
    'The scan only reads from GitHub, and the report stays on this machine.',
  ];
  if (telemetryEnabled) {
    lines.push(
      'It sends anonymous usage stats and crash reports (see the README).',
      'Set DO_NOT_TRACK=1 to turn them off.',
    );
  }
  return lines.join('\n');
}
