import type { ReactNode } from 'react';
import { useEmbeddedData } from '../data/EmbeddedDataContext.tsx';
import { fmtBytes } from '../format/bytes.ts';
import { fmtUsd } from '../format/money.ts';
import { useAssumptions } from '../hooks/useAssumptions.tsx';
import { type MethodologyTab, useAssumptionsDisclosure } from '../hooks/useAssumptionsDisclosure.tsx';
import { useRegisteredFootnotes } from '../hooks/useFootnotes.tsx';
import { AssumptionInput } from '../primitives/AssumptionInput.tsx';
import { AssumptionsFootnote, assumptionsPanelId } from '../primitives/AssumptionsFootnote.tsx';
import { Citation } from '../primitives/Citation.tsx';
import { reposWithoutSecurityAlertsId } from './RiskStory.tsx';

export const methodologyAppendixTestIds = {
  section: 'methodology-appendix-section',
  tabList: 'methodology-tab-list',
  tabPanel: 'methodology-tab-panel',
  sources: 'methodology-sources-and-notes',
  rawData: 'methodology-raw-data',
  disabledAlertsRepos: 'methodology-disabled-alerts-repos',
} as const;

const appendixTabs: Array<{ id: MethodologyTab; label: string }> = [
  { id: 'calculation', label: 'Calculation' },
  { id: 'data', label: 'Raw data' },
];

export function MethodologyAppendix() {
  const data = useEmbeddedData();
  const { assumptions } = useAssumptions();
  const { open, setOpen, activeTab, setActiveTab } = useAssumptionsDisclosure();
  const org = data.orgOverview;
  const cov = data.dependabotCoverage;
  const pr = data.prBacklog;
  const stalled = data.stalledSignals;
  const cve = data.cve;

  return (
    <section
      data-testid={methodologyAppendixTestIds.section}
      className="border-foreground text-foreground mt-20 border-t pt-10 text-sm"
    >
      <details open={open} onToggle={(e) => setOpen(e.currentTarget.open)}>
        <summary className="text-foreground hover:text-muted-foreground cursor-pointer text-base font-semibold tracking-tight select-none">
          How this report was calculated
        </summary>

        <div className="mt-6">
          <div
            data-testid={methodologyAppendixTestIds.tabList}
            role="tablist"
            aria-label="Report calculation details"
            className="border-border inline-flex max-w-full overflow-x-auto rounded-md border bg-card p-1"
          >
            {appendixTabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={activeTab === tab.id}
                aria-controls={`methodology-tab-${tab.id}`}
                id={`methodology-tab-trigger-${tab.id}`}
                onClick={() => setActiveTab(tab.id)}
                className={`rounded px-3 py-1.5 text-sm font-medium whitespace-nowrap transition-colors ${
                  activeTab === tab.id ? 'bg-foreground text-background' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div
            data-testid={methodologyAppendixTestIds.tabPanel}
            role="tabpanel"
            id={`methodology-tab-${activeTab}`}
            aria-labelledby={`methodology-tab-trigger-${activeTab}`}
            className="mt-6"
          >
            {activeTab === 'calculation' && (
              <div className="space-y-10">
                <section id={assumptionsPanelId} className="scroll-mt-16">
                  <SectionHeading>Cost assumptions</SectionHeading>
                  <p className="text-muted-foreground mt-2 max-w-3xl leading-relaxed">
                    Every cost and time figure in this report is modeled from these two inputs. Change them and the
                    numbers throughout recalculate. The defaults are intentionally conservative.
                  </p>
                  <div className="mt-3">
                    <AssumptionInput />
                  </div>
                </section>

                <section>
                  <SectionHeading>Calculation model</SectionHeading>
                  <div className="mt-3 overflow-hidden rounded-md border border-border">
                    <table className="w-full text-left text-sm">
                      <tbody className="divide-y divide-border">
                        <FormulaRow
                          label="Cost in window"
                          value={
                            <>
                              Merged PRs &times; minutes per PR &divide; 60 &times; hourly rate. Currently using
                              adjustable
                              <AssumptionsFootnote from="methodology-formula" /> assumptions:{' '}
                              {data.costEstimate.mergedInWindow} PRs &times; {assumptions.minutesPerPr} min &divide; 60
                              &times; ${assumptions.hourlyRateUsd}
                              /hr.
                            </>
                          }
                        />
                        <FormulaRow
                          label="Run rate"
                          value="Monthly run rate scales the window cost by (365 / 12) / windowDays. Annualized = monthly x 12."
                        />
                        <FormulaRow
                          label="Savings model"
                          value="Savings scenarios model the monthly cost recovered at 50% through 80% auto-merge share, annualized over 12 months."
                        />
                        <FormulaRow
                          label="People counts"
                          value="Bot accounts are excluded from merger and reviewer counts."
                        />
                        <FormulaRow
                          label="Security exposure"
                          value="CVE numbers count what Dependabot reports, not what is actually exploitable in your stack."
                        />
                      </tbody>
                    </table>
                  </div>
                  <p className="text-muted-foreground mt-4 leading-relaxed">
                    The adjustable
                    <AssumptionsFootnote from="methodology-minutes-default" /> 5 min/PR default is deliberately low. The
                    adjustable
                    <AssumptionsFootnote from="methodology-rate-default" /> $150/hr default reflects a $300k engineer
                    cost divided by 2,000 working hours.
                  </p>
                  <p className="text-muted-foreground mt-2 leading-relaxed">
                    Estimates only; real savings vary by team. The defaults are intentionally conservative
                    <Citation source="atlassian-dx-2025" />.
                  </p>
                </section>
              </div>
            )}

            {activeTab === 'data' && (
              <section data-testid={methodologyAppendixTestIds.rawData}>
                <SectionHeading>Raw investigation data</SectionHeading>
                <div className="mt-4 grid grid-cols-1 gap-6 lg:grid-cols-2">
                  <DataPanel title="Org scope">
                    <MetricList
                      rows={[
                        ['Window', `${data.meta.windowDays} days ending ${data.meta.generatedAt.slice(0, 10)}`],
                        [
                          'Repos scanned',
                          `${org.repoCount} active (${org.publicCount} public, ${org.privateCount} private, ${org.internalCount} internal)`,
                        ],
                        ['Archived excluded', org.archivedExcluded.toLocaleString()],
                        ['Active human committers', org.activeHumanCommitters.toLocaleString()],
                        ['Repos with branch protection', org.reposWithBranchProtection.toLocaleString()],
                      ]}
                    />
                  </DataPanel>

                  <DataPanel title="Dependabot coverage">
                    <MetricList
                      rows={[
                        ['Config coverage', `${cov.reposWithConfig} repos (${cov.reposWithConfigPercentage}%)`],
                        [
                          'Security updates',
                          `${cov.reposWithSecurityUpdates} repos (${cov.reposWithSecurityUpdatesPercentage}%)`,
                        ],
                        ['Repos using groups', cov.reposUsingGroups.toLocaleString()],
                        ['Repos with ignore rules', cov.reposWithIgnoreRules.toLocaleString()],
                      ]}
                    />
                    <InlineBreakdown
                      label="Ecosystems"
                      rows={cov.ecosystemBreakdown}
                      nameKey="ecosystem"
                      valueKey="repoCount"
                    />
                    <InlineBreakdown
                      label="Cadence"
                      rows={cov.cadenceBreakdown}
                      nameKey="interval"
                      valueKey="entryCount"
                    />
                  </DataPanel>

                  <DataPanel title="PR queue">
                    <MetricList
                      rows={[
                        ['Open', pr.openCount.toLocaleString()],
                        ['Merged in window', pr.mergedInWindowCount.toLocaleString()],
                        ['Closed unmerged in window', pr.closedInWindowCount.toLocaleString()],
                        ['Oldest open', pr.oldestOpenDays === null ? 'n/a' : `${pr.oldestOpenDays} days`],
                        [
                          'Time to merge',
                          `p50 ${pr.timeToMergeP50Days ?? 'n/a'}d, p90 ${pr.timeToMergeP90Days ?? 'n/a'}d`,
                        ],
                        ['Dev-only share', `${pr.devOnlyShare.count} PRs (${pr.devOnlyShare.percentage}%)`],
                        [
                          'CI status',
                          `${pr.ciStatusMix.green} green, ${pr.ciStatusMix.failing} failing, ${pr.ciStatusMix.pending} pending`,
                        ],
                      ]}
                    />
                    <InlineBreakdown label="Open PR age" rows={pr.openAgeBuckets} nameKey="label" valueKey="count" />
                    <InlineBreakdown label="Bump types" rows={pr.bumpTypeSplit} nameKey="bumpType" valueKey="count" />
                    <InlineBreakdown
                      label="Failing checks"
                      rows={pr.failingCheckBreakdown}
                      nameKey="checkName"
                      valueKey="failingPrCount"
                    />
                  </DataPanel>

                  <DataPanel title="Stalled signals">
                    <RepoList
                      label="Repos at PR cap"
                      empty="No repos are currently at the Dependabot PR cap."
                      repos={stalled.reposAtPrCap.map((r) => `${r.repo} (${r.openPrs} open)`)}
                    />
                    <RepoList
                      label="Config present, no recent PRs"
                      empty="No configured repos were missing recent Dependabot PRs."
                      repos={stalled.reposWithConfigButNoRecentPrs}
                    />
                  </DataPanel>

                  <DataPanel title="Security coverage">
                    <MetricList
                      rows={[
                        ['Alert status', cve.status],
                        ['Open alerts', cve.totalOpenAlerts.toLocaleString()],
                        [
                          'Severity',
                          `${cve.bySeverity.critical} critical, ${cve.bySeverity.high} high, ${cve.bySeverity.medium} medium, ${cve.bySeverity.low} low`,
                        ],
                        ['Oldest critical', cve.oldestCriticalDays === null ? 'n/a' : `${cve.oldestCriticalDays} days`],
                        ['Oldest high', cve.oldestHighDays === null ? 'n/a' : `${cve.oldestHighDays} days`],
                      ]}
                    />
                    <RepoList
                      id={reposWithoutSecurityAlertsId}
                      testId={methodologyAppendixTestIds.disabledAlertsRepos}
                      label="Repos without security alerts enabled"
                      empty="No scanned repos reported security alerts as disabled."
                      repos={cve.reposWithSecurityAlertsDisabled}
                    />
                    <SeverityTable repos={cve.topReposBySeverity} />
                  </DataPanel>

                  <DataPanel title="People signals">
                    <PeopleList label="Mergers" rows={data.people.mergers} countLabel="merged" />
                    <PeopleList label="Reviewers" rows={data.people.reviewers} countLabel="reviewed" />
                    <PeopleList label="Commenters" rows={data.people.commenters} countLabel="commented" />
                  </DataPanel>

                  {org.topLanguages.length > 0 && (
                    <DataPanel title="Language mix">
                      <ul className="space-y-1.5">
                        {org.topLanguages.map((l) => (
                          <li key={l.language} className="flex justify-between gap-4">
                            <span>{l.language}</span>
                            <span className="text-muted-foreground tabular-nums">
                              {fmtBytes(l.bytes)} ({l.percentage}%)
                            </span>
                          </li>
                        ))}
                      </ul>
                    </DataPanel>
                  )}
                </div>
              </section>
            )}
          </div>

          <section
            id="appendix-sources"
            data-testid={methodologyAppendixTestIds.sources}
            className="mt-10 scroll-mt-16"
          >
            <SectionHeading>Sources and notes</SectionHeading>
            <SourcesAndNotes />
          </section>
        </div>
      </details>

      <div className="border-border text-muted-foreground mt-12 border-t pt-5 text-xs">
        Generated by{' '}
        <a
          href="https://github.com/contextbridge/patchwave-analysis"
          className="text-primary underline underline-offset-4"
        >
          patchwave-analysis
        </a>
        . PatchWave is a project from{' '}
        <a href="https://contextbridge.ai" className="text-primary underline underline-offset-4">
          ContextBridge
        </a>
        .
      </div>
    </section>
  );
}

function SectionHeading({ children }: { children: string }) {
  return <h3 className="text-foreground text-base font-semibold tracking-tight">{children}</h3>;
}

function FormulaRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <tr>
      <th className="bg-muted/40 text-muted-foreground w-44 px-3 py-3 text-left align-top text-xs font-medium tracking-[0.12em] uppercase">
        {label}
      </th>
      <td className="text-foreground px-3 py-3 leading-relaxed">{value}</td>
    </tr>
  );
}

function DataPanel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="border-border bg-card rounded-md border p-4">
      <h4 className="text-foreground text-xs font-semibold tracking-[0.14em] uppercase">{title}</h4>
      <div className="mt-3 space-y-4">{children}</div>
    </div>
  );
}

function MetricList({ rows }: { rows: Array<[string, string]> }) {
  return (
    <dl className="space-y-2">
      {rows.map(([label, value]) => (
        <div key={label} className="flex justify-between gap-4">
          <dt className="text-muted-foreground">{label}</dt>
          <dd className="text-right font-medium tabular-nums">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function InlineBreakdown<T>({
  label,
  rows,
  nameKey,
  valueKey,
}: {
  label: string;
  rows: readonly T[];
  nameKey: keyof T;
  valueKey: keyof T;
}) {
  if (rows.length === 0) return null;
  return (
    <div>
      <div className="text-muted-foreground mb-1 text-xs font-medium tracking-[0.12em] uppercase">{label}</div>
      <ul className="space-y-1">
        {rows.map((row) => (
          <li key={String(row[nameKey])} className="flex justify-between gap-4">
            <span>{String(row[nameKey])}</span>
            <span className="text-muted-foreground tabular-nums">{String(row[valueKey])}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function SourcesAndNotes() {
  const notes = useRegisteredFootnotes();
  return (
    <div className="mt-3 space-y-3">
      {notes.map((note) => (
        <div id={`footnote-${note.id}`} key={note.id} className="scroll-mt-16 leading-relaxed">
          <span className="font-semibold tabular-nums">{note.number}. </span>
          <span className="font-medium">{note.title}. </span>
          <span className="text-muted-foreground">{note.body}</span>
        </div>
      ))}
    </div>
  );
}

function RepoList({
  id,
  testId,
  label,
  empty,
  repos,
}: {
  id?: string;
  testId?: string;
  label: string;
  empty: string;
  repos: readonly string[];
}) {
  return (
    <div id={id} data-testid={testId} className="scroll-mt-16">
      <div className="text-muted-foreground mb-1 text-xs font-medium tracking-[0.12em] uppercase">{label}</div>
      {repos.length === 0 ? (
        <p className="text-muted-foreground">{empty}</p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {repos.map((repo) => (
            <code key={repo} className="bg-muted rounded px-1.5 py-0.5 font-mono text-xs">
              {repo}
            </code>
          ))}
        </div>
      )}
    </div>
  );
}

function SeverityTable({
  repos,
}: {
  repos: ReadonlyArray<{ repo: string; critical: number; high: number; medium: number; low: number }>;
}) {
  if (repos.length === 0) return null;
  return (
    <div>
      <div className="text-muted-foreground mb-1 text-xs font-medium tracking-[0.12em] uppercase">
        Top repos by severity
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="text-muted-foreground">
            <tr>
              <th className="py-1 text-left font-medium">Repo</th>
              <th className="py-1 text-right font-medium">C</th>
              <th className="py-1 text-right font-medium">H</th>
              <th className="py-1 text-right font-medium">M</th>
              <th className="py-1 text-right font-medium">L</th>
            </tr>
          </thead>
          <tbody>
            {repos.map((repo) => (
              <tr key={repo.repo} className="border-border border-t">
                <td className="py-1.5 pr-2 font-mono">{repo.repo}</td>
                <td className="py-1.5 text-right tabular-nums">{repo.critical || ''}</td>
                <td className="py-1.5 text-right tabular-nums">{repo.high || ''}</td>
                <td className="py-1.5 text-right tabular-nums">{repo.medium || ''}</td>
                <td className="py-1.5 text-right tabular-nums">{repo.low || ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function PeopleList({
  label,
  rows,
  countLabel,
}: {
  label: string;
  rows: ReadonlyArray<{ login: string; count: number; annualCostUsd?: number }>;
  countLabel: string;
}) {
  return (
    <div>
      <div className="text-muted-foreground mb-1 text-xs font-medium tracking-[0.12em] uppercase">{label}</div>
      {rows.length === 0 ? (
        <p className="text-muted-foreground">No {countLabel} activity in the window.</p>
      ) : (
        <ul className="space-y-1">
          {rows.map((row) => (
            <li key={row.login} className="flex justify-between gap-4">
              <span className="font-mono">{row.login}</span>
              <span className="text-muted-foreground text-right tabular-nums">
                {row.count} {countLabel}
                {row.annualCostUsd !== undefined ? `, ${fmtUsd(row.annualCostUsd)}/yr` : ''}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
