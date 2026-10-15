import { useState } from 'react';
import { useEmbeddedData } from '../data/EmbeddedDataContext.tsx';
import { repoShortName } from '../format/repo.ts';
import { useAssumptionsDisclosure } from '../hooks/useAssumptionsDisclosure.tsx';
import { INSTALL_COMMAND } from '../lib/installCommand.ts';
import { ActHeader } from '../primitives/ActHeader.tsx';
import { Citation } from '../primitives/Citation.tsx';
import { CommandBlock } from '../primitives/CommandBlock.tsx';
import { SEGMENTS, StackedBar } from '../primitives/StackedBar.tsx';
import { Stat, StatGrid } from '../primitives/Stat.tsx';
import { SubHeading } from '../primitives/SubHeading.tsx';

export const riskStoryTestIds = {
  section: 'risk-story-section',
  heading: 'risk-story-heading',
  scopeRefreshCommand: 'risk-story-scope-refresh-command',
  runCommand: 'risk-story-run-command',
  severityBar: 'risk-story-severity-bar',
  topReposTable: 'risk-story-top-repos-table',
  topReposRow: 'risk-story-top-repos-row',
  topReposToggle: 'risk-story-top-repos-toggle',
  disabledAlertsWarning: 'risk-story-disabled-alerts-warning',
  disabledAlertsLink: 'risk-story-disabled-alerts-link',
} as const;

export const riskStoryCopy = {
  eyebrow: 'CVE exposure',
  scopeMissingHeading: 'Not measured this run',
  noAlertsHeading: 'No open security alerts',
  noAccessHeading: 'See your own CVE exposure',
} as const;

const INITIAL_REPO_COUNT = 5;
export const reposWithoutSecurityAlertsId = 'repos-without-security-alerts';

export function RiskStory() {
  const { cve, orgOverview, meta } = useEmbeddedData();
  const { reveal } = useAssumptionsDisclosure();
  const isScoped = meta.repositoryScope.mode === 'selected';

  if (cve.status === 'no-access') {
    return (
      <section data-testid={riskStoryTestIds.section}>
        <ActHeader icon="shield" eyebrow={riskStoryCopy.eyebrow} headingTestId={riskStoryTestIds.heading}>
          {riskStoryCopy.noAccessHeading}
        </ActHeader>
        <p className="text-foreground mt-5 leading-relaxed">
          Your account can't read <code>{meta.org}</code>'s Dependabot security alerts. Ask an org owner or security
          manager to run the checkup, and they'll see your open alerts here, ranked by severity and by how long they've
          sat unpatched.
        </p>
        <CommandBlock command={INSTALL_COMMAND} label="the install command" testId={riskStoryTestIds.runCommand} />
      </section>
    );
  }

  if (cve.status === 'scope-missing') {
    return (
      <section data-testid={riskStoryTestIds.section}>
        <ActHeader icon="shield" eyebrow={riskStoryCopy.eyebrow} headingTestId={riskStoryTestIds.heading}>
          {riskStoryCopy.scopeMissingHeading}
        </ActHeader>
        <p className="text-foreground mt-5 leading-relaxed">
          Reading Dependabot security alerts needs the{' '}
          <code className="bg-muted rounded px-1.5 py-0.5 font-mono text-sm">{cve.requiredScope}</code> OAuth scope,
          which the current token does not have. To include CVE metrics in the next run:
        </p>
        <CommandBlock
          command={`gh auth refresh -s ${cve.requiredScope}`}
          label="the refresh command"
          testId={riskStoryTestIds.scopeRefreshCommand}
        />
      </section>
    );
  }

  if (cve.totalOpenAlerts === 0) {
    return (
      <section data-testid={riskStoryTestIds.section}>
        <ActHeader icon="shield" eyebrow={riskStoryCopy.eyebrow} headingTestId={riskStoryTestIds.heading}>
          {riskStoryCopy.noAlertsHeading}
        </ActHeader>
        <p className="text-foreground mt-5 leading-relaxed">
          No open Dependabot security alerts across the repos in scope. That can mean you're caught up, or that security
          alerts aren't enabled everywhere. Check the appendix data for repos with alerts disabled.
        </p>
      </section>
    );
  }

  const hasOldest = cve.oldestCriticalDays !== null || cve.oldestHighDays !== null;

  return (
    <section data-testid={riskStoryTestIds.section}>
      <ActHeader icon="shield" eyebrow={riskStoryCopy.eyebrow} headingTestId={riskStoryTestIds.heading}>
        {cve.totalOpenAlerts.toLocaleString()} open security alerts
      </ActHeader>

      <p className="text-foreground mt-5 text-base leading-relaxed">
        AI made finding vulnerabilities the easy part; fixing them is now the bottleneck
        <Citation source="glasswing-2026" />. Anthropic's open-source program alone has logged more than 23,000
        vulnerabilities, and only 97 are patched so far
        <Citation source="anthropic-cvd-2026" />. As those fixes ship, the security-update PRs landing in your repos
        will climb.
      </p>

      <div data-testid={riskStoryTestIds.severityBar} className="border-border bg-card mt-6 rounded-md border p-5">
        <StackedBar
          critical={cve.bySeverity.critical}
          high={cve.bySeverity.high}
          medium={cve.bySeverity.medium}
          low={cve.bySeverity.low}
        />
      </div>

      {hasOldest && (
        <div className="mt-4">
          <StatGrid columns={2}>
            {cve.oldestCriticalDays !== null && (
              <Stat label="Oldest open Critical" value={`${cve.oldestCriticalDays} days`} tone="critical" />
            )}
            {cve.oldestHighDays !== null && (
              <Stat label="Oldest open High" value={`${cve.oldestHighDays} days`} tone="high" />
            )}
          </StatGrid>
        </div>
      )}

      {cve.topReposBySeverity.length > 0 && (
        <div className="mt-10">
          <SubHeading>Top repos by severity</SubHeading>
          <TopReposBySeverityBars repos={cve.topReposBySeverity} />
        </div>
      )}

      {cve.reposWithSecurityAlertsDisabled.length > 0 && (
        <p
          data-testid={riskStoryTestIds.disabledAlertsWarning}
          className="border-border bg-card text-muted-foreground mt-7 rounded-md border px-4 py-3 text-sm leading-relaxed"
        >
          <span className="text-foreground font-medium">Did you know:</span>{' '}
          <span className="text-foreground font-semibold tabular-nums">
            {cve.reposWithSecurityAlertsDisabled.length}
          </span>{' '}
          of {isScoped ? 'the selected' : 'your'}{' '}
          <span className="text-foreground font-semibold tabular-nums">{orgOverview.repoCount}</span> repos{' '}
          {cve.reposWithSecurityAlertsDisabled.length === 1 ? 'does' : 'do'} not have Dependabot security alerts
          enabled. New CVEs in {cve.reposWithSecurityAlertsDisabled.length === 1 ? 'that repo' : 'those repos'} will not
          appear in this report.{' '}
          <a
            href={`#${reposWithoutSecurityAlertsId}`}
            data-testid={riskStoryTestIds.disabledAlertsLink}
            onClick={() => reveal('calculation')}
            className="text-link"
          >
            {cve.reposWithSecurityAlertsDisabled.length === 1 ? 'See the repo' : 'See the full list'}
          </a>
          .
        </p>
      )}
    </section>
  );
}

interface RepoSeverityRow {
  repo: string;
  critical: number;
  high: number;
  medium: number;
  low: number;
}

// Bars scale to the busiest repo so length reads as volume; the distribution
// bar above already carries the legend, so these rows omit it.
function TopReposBySeverityBars({ repos }: { repos: readonly RepoSeverityRow[] }) {
  const [expanded, setExpanded] = useState(false);
  const visibleRepos = expanded ? repos : repos.slice(0, INITIAL_REPO_COUNT);
  const hiddenCount = repos.length - visibleRepos.length;
  const maxTotal = Math.max(1, ...repos.map(repoTotal));

  return (
    <div data-testid={riskStoryTestIds.topReposTable} className="mt-4 space-y-3">
      {visibleRepos.map((r) => (
        <RepoSeverityBar key={r.repo} repo={r} maxTotal={maxTotal} />
      ))}
      {hiddenCount > 0 || expanded ? (
        <button
          type="button"
          data-testid={riskStoryTestIds.topReposToggle}
          onClick={() => setExpanded((open) => !open)}
          className="text-muted-foreground hover:text-foreground pt-1 text-sm font-medium underline-offset-4 hover:underline"
        >
          {expanded ? 'Show top 5' : `Show ${hiddenCount.toLocaleString()} more`}
        </button>
      ) : null}
    </div>
  );
}

function RepoSeverityBar({ repo, maxTotal }: { repo: RepoSeverityRow; maxTotal: number }) {
  const total = repoTotal(repo);
  const counts = { critical: repo.critical, high: repo.high, medium: repo.medium, low: repo.low };
  return (
    <div
      data-testid={`${riskStoryTestIds.topReposRow}-${repo.repo}`}
      className="grid grid-cols-[minmax(0,10rem)_1fr_2.5rem] items-center gap-3 text-sm"
    >
      <div className="text-foreground truncate font-mono text-xs" title={repo.repo}>
        {repoShortName(repo.repo)}
      </div>
      <div className="bg-muted h-3.5 overflow-hidden rounded-full">
        <div className="flex h-full" style={{ width: `${(total / maxTotal) * 100}%` }}>
          {SEGMENTS.map((s) => {
            const v = counts[s.key];
            if (v === 0) return null;
            return (
              <div
                key={s.key}
                style={{ width: `${(v / total) * 100}%`, backgroundColor: s.cssVar }}
                title={`${s.label}: ${v}`}
              />
            );
          })}
        </div>
      </div>
      <div className="text-foreground text-right font-semibold tabular-nums">{total.toLocaleString()}</div>
    </div>
  );
}

function repoTotal(r: RepoSeverityRow): number {
  return r.critical + r.high + r.medium + r.low;
}
