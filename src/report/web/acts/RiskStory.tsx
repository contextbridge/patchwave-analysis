import { useState } from 'react';
import { useEmbeddedData } from '../data/EmbeddedDataContext.tsx';
import { Citation } from '../primitives/Citation.tsx';
import { FootnoteReference } from '../primitives/FootnoteReference.tsx';
import { StackedBar } from '../primitives/StackedBar.tsx';

export const riskStoryTestIds = {
  section: 'risk-story-section',
  heading: 'risk-story-heading',
  scopeRefreshCommand: 'risk-story-scope-refresh-command',
  severityBar: 'risk-story-severity-bar',
  topReposTable: 'risk-story-top-repos-table',
  topReposToggle: 'risk-story-top-repos-toggle',
  disabledAlertsWarning: 'risk-story-disabled-alerts-warning',
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
  const disabledAlertsNote =
    cve.reposWithSecurityAlertsDisabled.length > 0
      ? `Repos without security alerts enabled: ${cve.reposWithSecurityAlertsDisabled.join(', ')}. New CVEs in these repos will not appear in this report.`
      : 'These repos returned a not-enabled response for Dependabot security alerts, so new CVEs in them will not appear in this report.';

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
        Not every CVE is exploitable, so treat this as exposure, not breach risk. For triage, age is what matters: how
        long each alert has sat open.
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
          <TopReposBySeverityTable repos={cve.topReposBySeverity} />
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
          {cve.reposWithSecurityAlertsDisabled.length === 1 ? 'does' : 'do'} not have Dependabot security alerts enabled
          <FootnoteReference
            id="security-alerts-disabled"
            title="Repos without security alerts enabled"
            body={disabledAlertsNote}
          />
          . New CVEs in {cve.reposWithSecurityAlertsDisabled.length === 1 ? 'that repo' : 'those repos'} will not appear
          in this report.
        </p>
      )}

      <p className="text-muted-foreground mt-7 text-sm leading-relaxed">
        Just 13% of Dependabot security PRs get merged in open-source JavaScript projects
        <Citation source="pixee-merge-rates" />, which is why backlogs grow.
      </p>
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

function TopReposBySeverityTable({ repos }: { repos: readonly RepoSeverityRow[] }) {
  const [expanded, setExpanded] = useState(false);
  const visibleRepos = expanded ? repos : repos.slice(0, INITIAL_REPO_COUNT);
  const hiddenCount = repos.length - visibleRepos.length;

  return (
    <div
      data-testid={riskStoryTestIds.topReposTable}
      className="border-border bg-card mt-4 overflow-hidden rounded-md border"
    >
      <table className="w-full text-sm">
        <thead className="bg-muted text-muted-foreground text-xs font-medium tracking-[0.14em] uppercase">
          <tr>
            <th className="px-3 py-2.5 text-left">Repo</th>
            <th className="px-3 py-2.5 text-right">Critical</th>
            <th className="px-3 py-2.5 text-right">High</th>
            <th className="px-3 py-2.5 text-right">Medium</th>
            <th className="px-3 py-2.5 text-right">Low</th>
          </tr>
        </thead>
        <tbody>
          {visibleRepos.map((r) => (
            <tr key={r.repo} className="border-border border-t last:border-b-0">
              <td className="text-foreground px-3 py-2.5 font-mono">{r.repo}</td>
              <td className="text-destructive px-3 py-2.5 text-right tabular-nums">{r.critical || ''}</td>
              <td className="text-tangerine px-3 py-2.5 text-right tabular-nums">{r.high || ''}</td>
              <td className="text-amber-700 px-3 py-2.5 text-right tabular-nums">{r.medium || ''}</td>
              <td className="text-muted-foreground px-3 py-2.5 text-right tabular-nums">{r.low || ''}</td>
            </tr>
          ))}
          {hiddenCount > 0 || expanded ? (
            <tr className="border-border border-t">
              <td colSpan={5} className="px-3 py-2.5 text-center">
                <button
                  type="button"
                  data-testid={riskStoryTestIds.topReposToggle}
                  onClick={() => setExpanded((open) => !open)}
                  className="text-muted-foreground hover:text-foreground text-sm font-medium underline-offset-4 hover:underline"
                >
                  {expanded ? 'Show top 5' : `Show ${hiddenCount.toLocaleString()} more`}
                </button>
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}

function AgeCell({ label, days, tone }: { label: string; days: number; tone: 'critical' | 'high' }) {
  const color = tone === 'critical' ? 'text-destructive' : 'text-tangerine';
  return (
    <div className="bg-card p-5">
      <div className="text-muted-foreground text-xs font-medium tracking-[0.14em] uppercase">{label}</div>
      <div className={`mt-1.5 text-2xl font-medium tabular-nums ${color}`}>{days} days</div>
    </div>
  );
}
