import { useState } from 'react';
import { useEmbeddedData } from '../data/EmbeddedDataContext.tsx';
import { useAssumptionsDisclosure } from '../hooks/useAssumptionsDisclosure.tsx';
import { Citation } from '../primitives/Citation.tsx';
import { SEGMENTS, StackedBar } from '../primitives/StackedBar.tsx';

export const riskStoryTestIds = {
  section: 'risk-story-section',
  heading: 'risk-story-heading',
  scopeRefreshCommand: 'risk-story-scope-refresh-command',
  severityBar: 'risk-story-severity-bar',
  topReposTable: 'risk-story-top-repos-table',
  topReposToggle: 'risk-story-top-repos-toggle',
  disabledAlertsWarning: 'risk-story-disabled-alerts-warning',
  disabledAlertsLink: 'risk-story-disabled-alerts-link',
} as const;

export const riskStoryCopy = {
  eyebrow: 'CVE exposure',
  scopeMissingHeading: 'Not measured this run',
  noAlertsHeading: 'No open security alerts',
} as const;

const INITIAL_REPO_COUNT = 5;
export const reposWithoutSecurityAlertsId = 'repos-without-security-alerts';

export function RiskStory() {
  const { cve, orgOverview } = useEmbeddedData();
  const { reveal } = useAssumptionsDisclosure();

  if (cve.status === 'scope-missing') {
    return (
      <section data-testid={riskStoryTestIds.section} className="border-foreground mt-20 border-t pt-10">
        <div className="text-muted-foreground text-xs font-medium tracking-[0.16em] uppercase">
          {riskStoryCopy.eyebrow}
        </div>
        <h2
          data-testid={riskStoryTestIds.heading}
          className="text-foreground mt-2 text-3xl leading-tight font-medium tracking-tight sm:text-4xl"
        >
          {riskStoryCopy.scopeMissingHeading}
        </h2>
        <p className="text-foreground mt-5 leading-relaxed">
          Reading Dependabot security alerts needs the{' '}
          <code className="bg-muted rounded px-1.5 py-0.5 font-mono text-sm">{cve.requiredScope}</code> OAuth scope,
          which the current token does not have. To include CVE metrics in the next run:
        </p>
        <pre
          data-testid={riskStoryTestIds.scopeRefreshCommand}
          className="bg-foreground text-background mt-4 overflow-x-auto rounded-md px-4 py-3 font-mono text-sm"
        >
          <code>gh auth refresh -s {cve.requiredScope}</code>
        </pre>
      </section>
    );
  }

  if (cve.totalOpenAlerts === 0) {
    return (
      <section data-testid={riskStoryTestIds.section} className="border-foreground mt-20 border-t pt-10">
        <div className="text-muted-foreground text-xs font-medium tracking-[0.16em] uppercase">
          {riskStoryCopy.eyebrow}
        </div>
        <h2
          data-testid={riskStoryTestIds.heading}
          className="text-foreground mt-2 text-3xl leading-tight font-medium tracking-tight sm:text-4xl"
        >
          {riskStoryCopy.noAlertsHeading}
        </h2>
        <p className="text-foreground mt-5 leading-relaxed">
          No open Dependabot security alerts across the repos in scope. That can mean you're caught up, or that security
          alerts aren't enabled everywhere. Check the appendix data for repos with alerts disabled.
        </p>
      </section>
    );
  }

  const hasOldest = cve.oldestCriticalDays !== null || cve.oldestHighDays !== null;

  return (
    <section data-testid={riskStoryTestIds.section} className="border-foreground mt-20 border-t pt-10">
      <div className="text-muted-foreground text-xs font-medium tracking-[0.16em] uppercase">
        {riskStoryCopy.eyebrow}
      </div>
      <h2
        data-testid={riskStoryTestIds.heading}
        className="text-foreground mt-2 text-3xl leading-tight font-medium tracking-tight sm:text-4xl"
      >
        {cve.totalOpenAlerts.toLocaleString()} open security alerts
      </h2>

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
        <div className="bg-foreground mt-4 grid grid-cols-2 gap-px">
          {cve.oldestCriticalDays !== null && (
            <AgeCell label="Oldest open Critical" days={cve.oldestCriticalDays} tone="critical" />
          )}
          {cve.oldestHighDays !== null && <AgeCell label="Oldest open High" days={cve.oldestHighDays} tone="high" />}
        </div>
      )}

      {cve.topReposBySeverity.length > 0 && (
        <>
          <h3 className="text-foreground mt-10 text-sm font-semibold tracking-[0.14em] uppercase">
            Top repos by severity
          </h3>
          <TopReposBySeverityBars repos={cve.topReposBySeverity} />
        </>
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
          of your <span className="text-foreground font-semibold tabular-nums">{orgOverview.repoCount}</span> repos{' '}
          {cve.reposWithSecurityAlertsDisabled.length === 1 ? 'does' : 'do'} not have Dependabot security alerts
          enabled. New CVEs in {cve.reposWithSecurityAlertsDisabled.length === 1 ? 'that repo' : 'those repos'} will not
          appear in this report.{' '}
          <a
            href={`#${reposWithoutSecurityAlertsId}`}
            data-testid={riskStoryTestIds.disabledAlertsLink}
            onClick={() => reveal('calculation')}
            className="text-primary underline underline-offset-4"
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
    <div className="grid grid-cols-[minmax(0,10rem)_1fr_2.5rem] items-center gap-3 text-sm">
      <div className="text-foreground truncate font-mono text-xs" title={repo.repo}>
        {repo.repo}
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

function AgeCell({ label, days, tone }: { label: string; days: number; tone: 'critical' | 'high' }) {
  const color = tone === 'critical' ? 'var(--severity-critical)' : 'var(--severity-high)';
  return (
    <div className="bg-card p-5">
      <div className="text-muted-foreground text-xs font-medium tracking-[0.14em] uppercase">{label}</div>
      <div className="mt-1.5 text-2xl font-medium tabular-nums" style={{ color }}>
        {days} days
      </div>
    </div>
  );
}
