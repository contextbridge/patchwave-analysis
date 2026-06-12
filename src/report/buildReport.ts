import { ResultAsync } from 'neverthrow';
import { collectAll } from '../collectors/collectAll.ts';
import type { TargetKind } from '../collectors/repos.ts';
import type { Context } from '../context/index.ts';
import type { ReportAnalyticsConfig } from '../telemetry/Analytics.ts';
import type { RepoMeta, RepositorySelection } from '../types.ts';
import { aggregate } from './aggregate.ts';
import { type RenderError, renderHtml } from './html.ts';

export interface ReportStats {
  readonly reposTotal: number;
  readonly reposIncluded: number;
  readonly dependabotPrs: number;
  readonly warnings: number;
}

export interface BuildReportInput {
  readonly target: string;
  readonly targetKind: TargetKind;
  readonly repos: RepoMeta[];
  readonly repositorySelection: RepositorySelection;
  readonly windowDays: number;
  readonly analytics: ReportAnalyticsConfig;
}

export interface BuiltReport {
  readonly report: string;
  readonly stats: ReportStats;
}

// Crawls the target, aggregates the slices into a report bundle, and renders the
// self-contained HTML — the full data pipeline behind a single scan. The caller
// owns orchestration (telemetry, temp dirs, writing the file).
export function buildReport(ctx: Context, input: BuildReportInput): ResultAsync<BuiltReport, RenderError> {
  const { target, targetKind, repos, repositorySelection, windowDays, analytics } = input;
  const now = ctx.clock.now();
  const windowStart = now.subtract({ hours: windowDays * 24 });

  return ResultAsync.fromSafePromise(
    collectAll(ctx, { repos, target, targetKind, windowDays, windowStart, now, repositorySelection }),
  ).andThen((data) => {
    const bundle = aggregate(data);
    const reposIncluded = bundle.orgOverview.repoCount;
    ctx.logger.info(
      { total: repos.length, included: reposIncluded, dependabotPrs: data.dependabotPrs.length },
      `crawled ${data.dependabotPrs.length} Dependabot PRs across ${reposIncluded}/${repos.length} active repos; rendering report`,
    );
    if (data.errors.length > 0) {
      // Reported (pino -> Sentry) so we can see how often collection degrades —
      // these are dropped data, not incidental noise.
      ctx.logger.error(
        { count: data.errors.length },
        `${data.errors.length} per-repo warnings were suppressed during crawl`,
      );
    }
    return renderHtml(bundle, analytics).map(
      (report): BuiltReport => ({
        report,
        stats: {
          reposTotal: repos.length,
          reposIncluded,
          dependabotPrs: data.dependabotPrs.length,
          warnings: data.errors.length,
        },
      }),
    );
  });
}
