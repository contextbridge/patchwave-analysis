import type { Instant } from '../time.ts';
import type {
  CveExposure,
  DependabotCoverage,
  OrgOverview,
  People,
  PrBacklog,
  Recommendation,
  ReportBundle,
  ReportMeta,
  StalledSignals,
  ToilCost,
} from './aggregate.ts';

export function renderMarkdown(bundle: ReportBundle): string {
  const sections = [
    renderHeader(bundle.meta),
    renderExecutiveSnapshot(bundle),
    renderOrgOverview(bundle.orgOverview),
    renderDependabotCoverage(bundle.dependabotCoverage),
    renderPrBacklog(bundle.prBacklog),
    renderStalledSignals(bundle.stalledSignals),
    renderPeople(bundle.people),
    renderToilCost(bundle.toilCost),
    renderCve(bundle.cve),
    renderRecommendations(bundle.recommendations),
    renderFooter(),
  ];
  return sections.join('\n\n').trim() + '\n';
}

function renderHeader(meta: ReportMeta): string {
  return [
    `# Dependabot diagnostic — \`${meta.org}\``,
    '',
    `Generated ${formatDate(meta.generatedAt)} · ${meta.windowDays}-day rolling window · ${meta.totalReposScanned} repos scanned`,
  ].join('\n');
}

function renderExecutiveSnapshot(b: ReportBundle): string {
  const cveSummary =
    b.cve.status === 'ok'
      ? `${b.cve.totalOpenAlerts} open Dependabot security alerts (${b.cve.bySeverity.critical} critical / ${b.cve.bySeverity.high} high)`
      : `CVE exposure not measured (${b.cve.status === 'scope-missing' ? 'missing GitHub scope' : 'no data'})`;
  return [
    `## Executive snapshot`,
    '',
    `**${b.prBacklog.mergedInWindowCount}** Dependabot PRs merged in the last ${b.meta.windowDays} days. **${b.prBacklog.openCount}** still open${b.prBacklog.oldestOpenDays !== null ? `; oldest is ${b.prBacklog.oldestOpenDays} days old` : ''}. Estimated **${b.toilCost.estimatedEngineerHoursPerWeek} engineer-hours/week** spent on this work (~$${b.toilCost.estimatedWeeklyCostUsd}/week at $${b.toilCost.assumptions.hourlyRateUsd}/hr). ${cveSummary}.`,
  ].join('\n');
}

function renderOrgOverview(o: OrgOverview): string {
  const lines: string[] = [`## Org overview`, ''];
  lines.push(
    `- **${o.repoCount}** active repos (public ${o.publicCount} · private ${o.privateCount} · internal ${o.internalCount})` +
      (o.archivedExcluded > 0 ? ` — ${o.archivedExcluded} archived repos excluded` : ''),
  );
  lines.push(`- **${o.activeHumanCommitters}** distinct human committers active in window`);
  lines.push(`- **${o.reposWithBranchProtection}** repos with default-branch protection in place`);
  lines.push(`- **${o.nodeTsRepoCount}** repos (${o.nodeTsRepoPercentage}%) are primarily TypeScript or JavaScript`);
  if (o.topLanguages.length > 0) {
    lines.push('', `### Language mix`, '', '| Language | Bytes | Share |', '|---|---:|---:|');
    for (const lang of o.topLanguages.slice(0, 8)) {
      lines.push(`| ${lang.language} | ${formatBytes(lang.bytes)} | ${lang.percentage}% |`);
    }
  }
  return lines.join('\n');
}

function renderDependabotCoverage(c: DependabotCoverage): string {
  const lines: string[] = [`## Dependabot coverage`, ''];
  lines.push(
    `- **${c.reposWithConfig}** repos (${c.reposWithConfigPercentage}%) have a \`.github/dependabot.yml\` config`,
  );
  lines.push(
    `- **${c.reposWithSecurityUpdates}** repos (${c.reposWithSecurityUpdatesPercentage}%) have Dependabot security updates enabled`,
  );
  if (c.ecosystemBreakdown.length > 0) {
    lines.push('', `### Ecosystems configured`, '');
    lines.push('| Ecosystem | Repos |');
    lines.push('|---|---:|');
    for (const e of c.ecosystemBreakdown) lines.push(`| ${e.ecosystem} | ${e.repoCount} |`);
  }
  if (c.packageManagerSplit.length > 0) {
    lines.push('', `### Node package manager split`, '');
    lines.push('| Manager | Repos |');
    lines.push('|---|---:|');
    for (const p of c.packageManagerSplit) lines.push(`| ${p.manager} | ${p.repoCount} |`);
  }
  return lines.join('\n');
}

function renderPrBacklog(b: PrBacklog): string {
  const lines: string[] = [
    `## Pull-request backlog`,
    '',
    `- **${b.openCount}** open Dependabot PRs · **${b.mergedInWindowCount}** merged · **${b.closedInWindowCount}** closed without merging (in window)`,
    `- Time to merge: p50 ${formatDays(b.timeToMergeP50Days)} · p90 ${formatDays(b.timeToMergeP90Days)}`,
    '',
    `### Open PRs by age`,
    '',
    '| Age bucket | Count |',
    '|---|---:|',
  ];
  for (const bucket of b.openAgeBuckets) lines.push(`| ${bucket.label} | ${bucket.count} |`);

  if (b.bumpTypeSplit.length > 0) {
    lines.push('', `### Bump-type split`, '', '| Bump type | Count | Share |', '|---|---:|---:|');
    for (const split of b.bumpTypeSplit) {
      lines.push(`| ${split.bumpType} | ${split.count} | ${split.percentage}% |`);
    }
  }

  lines.push(
    '',
    `### Dev-only dependency share`,
    '',
    `${b.devOnlyShare.count} of the Dependabot PRs in window (${b.devOnlyShare.percentage}%) touch only \`devDependencies\` (based on conventional commit prefix).`,
  );

  lines.push(
    '',
    `### CI status on open PRs`,
    '',
    `- Green: ${b.ciStatusMix.green}`,
    `- Failing: ${b.ciStatusMix.failing}`,
    `- Pending / no checks: ${b.ciStatusMix.pending}`,
  );

  if (b.failingCheckBreakdown.length > 0) {
    const topN = 15;
    const top = b.failingCheckBreakdown.slice(0, topN);
    const overflow = b.failingCheckBreakdown.length - top.length;
    lines.push('', `### Failing checks across open PRs`, '', '| Check | Open PRs failing |', '|---|---:|');
    for (const entry of top) {
      lines.push(`| \`${entry.checkName}\` | ${entry.failingPrCount} |`);
    }
    if (overflow > 0) {
      lines.push('', `_… and ${overflow} more check names with fewer failures._`);
    }
  }

  return lines.join('\n');
}

function renderStalledSignals(s: StalledSignals): string {
  const lines: string[] = [`## Stalled-PR signals`, ''];
  if (s.reposAtPrCap.length === 0) {
    lines.push("- No repos sitting at Dependabot's default 5-PR cap.");
  } else {
    lines.push(
      `- **${s.reposAtPrCap.length}** repos are at or above Dependabot's default 5-PR cap (Dependabot may have stopped opening new PRs there):`,
    );
    for (const entry of s.reposAtPrCap.slice(0, 10)) {
      lines.push(`  - \`${entry.repo}\` — ${entry.openPrs} open`);
    }
  }
  if (s.reposWithConfigButNoRecentPrs.length > 0) {
    lines.push(
      '',
      `- **${s.reposWithConfigButNoRecentPrs.length}** repos have a Dependabot config but no new Dependabot PRs in window:`,
    );
    for (const repo of s.reposWithConfigButNoRecentPrs.slice(0, 10)) {
      lines.push(`  - \`${repo}\``);
    }
  }
  lines.push(
    '',
    `- **${s.revertsInWindow}** total reverts in window; **${s.dependabotRevertsInWindow}** of those reverted a Dependabot PR.`,
  );
  return lines.join('\n');
}

function renderPeople(p: People): string {
  const lines: string[] = [`## People`, ''];
  lines.push(`- Auto-merge in use on **${p.autoMergePrCount}** Dependabot PRs in window`);
  lines.push('', `### Top mergers`, '');
  if (p.topMergers.length === 0) lines.push('_No merge activity in window._');
  else for (const m of p.topMergers) lines.push(`- \`${m.login}\` — ${m.count} PRs`);
  lines.push('', `### Top reviewers`, '');
  if (p.topReviewers.length === 0) lines.push('_No review activity in window._');
  else for (const r of p.topReviewers) lines.push(`- \`${r.login}\` — ${r.count} reviews`);
  return lines.join('\n');
}

function renderToilCost(t: ToilCost): string {
  return [
    `## Toil cost estimate`,
    '',
    `Based on ${t.mergedInWindow} merged PRs at ${t.assumptions.minutesPerMergedPr} min each and ${t.openOver30Days} stale-PR mental-tax minutes at ${t.assumptions.idleMinutesPerStalePr} min/week:`,
    '',
    `- **${t.estimatedEngineerHoursPerWeek} engineer-hours/week**`,
    `- **~$${t.estimatedWeeklyCostUsd}/week** at $${t.assumptions.hourlyRateUsd}/hr fully-loaded comp`,
    '',
    `These are conservative numbers and exclude context-switching cost. Adjust mentally for your team — at ${t.assumptions.minutesPerMergedPr * 2} min/PR the toil doubles.`,
  ].join('\n');
}

function renderCve(c: CveExposure): string {
  if (c.status === 'scope-missing') {
    return [
      `## CVE exposure (scope missing)`,
      '',
      `Reading Dependabot security alerts requires the \`${c.requiredScope}\` OAuth scope, which the current token doesn't have. To include CVE metrics in the next run:`,
      '',
      '```sh',
      `gh auth refresh -s ${c.requiredScope}`,
      '```',
    ].join('\n');
  }
  const lines: string[] = [`## CVE exposure`, ''];
  lines.push(
    `**${c.totalOpenAlerts}** open Dependabot security alerts: ` +
      `${c.bySeverity.critical} critical · ${c.bySeverity.high} high · ${c.bySeverity.medium} medium · ${c.bySeverity.low} low`,
  );
  if (c.oldestCriticalDays !== null) {
    lines.push(`- Oldest open Critical: **${c.oldestCriticalDays} days**`);
  }
  if (c.oldestHighDays !== null) {
    lines.push(`- Oldest open High: **${c.oldestHighDays} days**`);
  }
  if (c.topReposBySeverity.length > 0) {
    lines.push(
      '',
      `### Top repos by severity`,
      '',
      '| Repo | Critical | High | Medium | Low |',
      '|---|---:|---:|---:|---:|',
    );
    for (const r of c.topReposBySeverity) {
      lines.push(`| \`${r.repo}\` | ${r.critical} | ${r.high} | ${r.medium} | ${r.low} |`);
    }
  }
  if (c.reposWithSecurityAlertsDisabled.length > 0) {
    lines.push(
      '',
      `_${c.reposWithSecurityAlertsDisabled.length} repos appear to have Dependabot security alerts disabled or no entitlement._`,
    );
  }
  return lines.join('\n');
}

function renderRecommendations(recs: Recommendation[]): string {
  const lines: string[] = [`## Recommendations`, ''];
  if (recs.length === 0) {
    lines.push('_No high-leverage recommendations from this run — nothing jumps out as broken._');
    return lines.join('\n');
  }
  const order: Recommendation['priority'][] = ['high', 'medium', 'low'];
  for (const priority of order) {
    const items = recs.filter((r) => r.priority === priority);
    if (items.length === 0) continue;
    lines.push(`### ${capitalize(priority)} priority`, '');
    for (const item of items) lines.push(`- ${item.message}`);
    lines.push('');
  }
  return lines.join('\n').trim();
}

function renderFooter(): string {
  return [
    '---',
    '',
    '_Generated by [patchwave-analysis](https://github.com/contextbridge/patchwave-analysis). PatchWave is a GitHub App that automates Dependabot triage with code-aware risk analysis — reply to share this report or learn more._',
  ].join('\n');
}

function formatDate(d: Instant): string {
  return d.toString().slice(0, 10);
}

function formatDays(days: number | null): string {
  if (days === null) return 'n/a';
  return `${days}d`;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${round1(kb)} KB`;
  const mb = kb / 1024;
  return `${round1(mb)} MB`;
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
