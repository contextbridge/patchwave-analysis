export function welcomeBannerTitle(): string {
  return 'PatchWave Dependency Checkup';
}

export function welcomeBannerBody({ telemetryEnabled }: { telemetryEnabled: boolean }): string {
  const lines = [
    'This scan reads a GitHub org and writes an executive summary of what',
    'Dependabot toil and CVE exposure cost it: engineer-hours spent on',
    'Dependabot PRs, the open PR backlog, and unresolved security alerts.',
    '',
    'PatchWave (patchwave.ai) is a GitHub app that automatically analyzes,',
    'fixes and merges your Dependabot PRs.',
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
