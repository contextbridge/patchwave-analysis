import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { Result, ResultAsync } from 'neverthrow';
import { getBranchProtection } from './collectors/branchProtection.ts';
import { getCveAlerts } from './collectors/cve.ts';
import { getDependabotConfig } from './collectors/dependabotConfig.ts';
import { listDependabotPrs } from './collectors/dependabotPrs.ts';
import { listOrgRepos } from './collectors/repos.ts';
import { mapWithConcurrency } from './concurrency.ts';
import type { Context } from './context.ts';
import { getErrorMessage } from './errors.ts';
import { formatFsError } from './FileSystem.ts';
import { type GithubError, formatGithubError } from './github/errors.ts';
import { promptForTarget } from './interactive/targetPrompt.ts';
import { formatPromptError } from './prompt/Prompter.ts';
import { aggregate } from './report/aggregate.ts';
import { type RenderError, renderHtml } from './report/html.ts';
import type { ReportAnalyticsConfig } from './report/reportAnalyticsConfig.ts';
import { type Instant, Temporal } from './time.ts';
import type {
  BranchProtectionSlice,
  CollectedData,
  CollectorWarning,
  CveSlice,
  DependabotConfigSlice,
  DependabotPr,
  RepoMeta,
} from './types.ts';

// The CLI is intentionally flag-free (besides --help): the rolling window, output
// location, and repo filtering are fixed for now. These live as constants so the
// pipeline below stays unchanged if we re-add flags later.
const WINDOW_DAYS = 90;
const OUTPUT_BASENAME = 'patchwave-report';
const TEMP_DIR_PREFIX = 'patchwave-analysis-';

export interface CliOptions {
  /** `null` means the user didn't pass a positional target — `main()` will prompt for one. */
  readonly target: string | null;
}

interface ResolvedOptions {
  readonly target: string;
  readonly windowDays: number;
  readonly outBase: string;
  readonly include: string[] | null;
  readonly exclude: string[];
}

export interface OutputPaths {
  readonly html: string;
}

export function resolveOutputPaths(outBase: string): OutputPaths {
  return {
    html: `${outBase}.html`,
  };
}

export interface CompletedRun {
  readonly target: string;
  readonly paths: OutputPaths;
  readonly html: string;
}

export type MainResult =
  | { kind: 'usage'; code: number }
  | { kind: 'failed'; code: number }
  | { kind: 'completed'; code: 0; run: CompletedRun };

export async function main(ctx: Context, argv: readonly string[]): Promise<MainResult> {
  const parsed = parseCli(argv);
  if (parsed.kind === 'err') {
    if (parsed.message.length > 0) ctx.logger.error(parsed.message);
    // usage text is a multi-line reference document, not a log line — bypass pino.
    ctx.io.writeStderr(`${usage()}\n`);
    return { kind: 'usage', code: parsed.message.length > 0 ? 1 : 0 };
  }
  const flagOpts = parsed.value;
  const startedAt = ctx.clock.now();

  // One id per run, registered as a super-property so every CLI event carries it and joins to the
  // report-view events the frontend sends under the same pw_report_id.
  const reportId = crypto.randomUUID();
  ctx.analytics.register({ pw_report_id: reportId });

  let target: string;
  if (flagOpts.target === null) {
    const targetResult = await promptForTarget({ prompter: ctx.prompter, githubClient: ctx.githubClient });
    if (targetResult.isErr()) {
      ctx.prompter.error(`couldn't read target: ${formatPromptError(targetResult.error)}`);
      return { kind: 'failed', code: 1 };
    }
    target = targetResult.value;
  } else {
    target = flagOpts.target;
  }

  const tempDirResult = await ctx.fs.makeTempDir(TEMP_DIR_PREFIX);
  if (tempDirResult.isErr()) {
    ctx.prompter.error(formatFsError(tempDirResult.error));
    ctx.analytics.capture('run_failed', {
      error_kind: tempDirResult.error.kind,
      duration_ms: elapsedMs(startedAt, ctx.clock.now()),
    });
    return { kind: 'failed', code: 1 };
  }

  const opts: ResolvedOptions = {
    target,
    windowDays: WINDOW_DAYS,
    outBase: join(tempDirResult.value, OUTPUT_BASENAME),
    include: null,
    exclude: [],
  };

  ctx.analytics.capture('run_started', {
    window_days: opts.windowDays,
    has_include: opts.include !== null,
    has_exclude: opts.exclude.length > 0,
    target_prompted: flagOpts.target === null,
  });

  const spinner = ctx.prompter.spinner();
  spinner.start(`Scanning ${opts.target} (last ${opts.windowDays} days)...`);

  const analyticsEmbed: ReportAnalyticsConfig = {
    telemetryDisabled: ctx.telemetryDisabled,
    reportId,
    generatedByAnonId: ctx.distinctId,
    version: ctx.appVersion,
  };

  const paths = resolveOutputPaths(opts.outBase);
  const renderResult = await renderReport(ctx, opts, analyticsEmbed);
  if (renderResult.isErr()) {
    const error = renderResult.error;
    spinner.stop('Scan failed.');
    ctx.prompter.error(error.kind === 'missing-placeholder' ? error.message : formatGithubError(error));
    ctx.analytics.capture('run_failed', {
      error_kind: error.kind,
      duration_ms: elapsedMs(startedAt, ctx.clock.now()),
    });
    return { kind: 'failed', code: 1 };
  }

  const { report, stats } = renderResult.value;

  const htmlResult = await ctx.fs.writeTextFile(paths.html, report);
  if (htmlResult.isErr()) {
    spinner.stop('Scan failed.');
    ctx.prompter.error(formatFsError(htmlResult.error));
    ctx.analytics.capture('run_failed', {
      error_kind: 'write-failed',
      duration_ms: elapsedMs(startedAt, ctx.clock.now()),
    });
    return { kind: 'failed', code: 1 };
  }

  spinner.stop(`Scanned ${opts.target}.`);
  ctx.analytics.capture('run_completed', {
    window_days: opts.windowDays,
    repos_total: stats.reposTotal,
    repos_included: stats.reposIncluded,
    dependabot_prs: stats.dependabotPrs,
    warnings: stats.warnings,
    duration_ms: elapsedMs(startedAt, ctx.clock.now()),
  });
  return {
    kind: 'completed',
    code: 0,
    run: { target: opts.target, paths, html: report },
  };
}

interface ReportStats {
  readonly reposTotal: number;
  readonly reposIncluded: number;
  readonly dependabotPrs: number;
  readonly warnings: number;
}

interface RenderedReport {
  readonly report: string;
  readonly stats: ReportStats;
}

function elapsedMs(start: Instant, end: Instant): number {
  return Number(end.epochMilliseconds - start.epochMilliseconds);
}

function renderReport(
  ctx: Context,
  opts: ResolvedOptions,
  analytics: ReportAnalyticsConfig,
): ResultAsync<RenderedReport, GithubError | RenderError> {
  ctx.logger.info(
    { target: opts.target, windowDays: opts.windowDays },
    `scanning ${opts.target} (${opts.windowDays}-day window)`,
  );
  return listOrgRepos(ctx.githubClient, opts.target).andThen((repos) => {
    const filtered = filterRepos(repos, opts);
    ctx.logger.info(
      { total: repos.length, included: filtered.length },
      `found ${repos.length} repos; ${filtered.length} included after filters`,
    );
    const now = ctx.clock.now();
    const windowStart = now.subtract(Temporal.Duration.from({ hours: opts.windowDays * 24 }));

    return ResultAsync.fromSafePromise(
      collectAll(ctx, filtered, opts.target, opts.windowDays, windowStart, now),
    ).andThen((data) => {
      ctx.logger.info(
        { dependabotPrs: data.dependabotPrs.length, warnings: data.errors.length },
        `crawled ${data.dependabotPrs.length} Dependabot PRs; rendering report`,
      );
      if (data.errors.length > 0) {
        ctx.logger.warn(
          { count: data.errors.length },
          `${data.errors.length} per-repo warnings were suppressed during crawl`,
        );
      }
      const bundle = aggregate(data);
      return renderHtml(bundle, analytics).map(
        (report): RenderedReport => ({
          report,
          stats: {
            reposTotal: repos.length,
            reposIncluded: filtered.length,
            dependabotPrs: data.dependabotPrs.length,
            warnings: data.errors.length,
          },
        }),
      );
    });
  });
}

async function collectAll(
  ctx: Context,
  repos: RepoMeta[],
  target: string,
  windowDays: number,
  windowStart: Instant,
  now: Instant,
): Promise<CollectedData> {
  const client = ctx.githubClient;
  const warnings: CollectorWarning[] = [];
  const windowStartIso = windowStart.toString();

  const [dependabotConfig, cve, branchProtection, dependabotPrs] = await Promise.all([
    crawlPerRepo<DependabotConfigSlice>(
      repos,
      (r) => getDependabotConfig(client, { owner: r.owner, name: r.name }),
      warnings,
      'dependabotConfig',
    ),
    crawlPerRepo<CveSlice>(repos, (r) => getCveAlerts(client, { owner: r.owner, name: r.name }), warnings, 'cve'),
    crawlPerRepo<BranchProtectionSlice>(
      repos,
      (r) => getBranchProtection(client, { owner: r.owner, name: r.name }, r.defaultBranch),
      warnings,
      'branchProtection',
    ),
    runResultAsync<DependabotPr[]>(listDependabotPrs(client, target, windowStartIso), [], warnings, 'dependabotPrs'),
  ]);

  return {
    ctx: { org: target, windowDays, windowStart, now },
    repos,
    dependabotConfig,
    dependabotPrs,
    cve,
    branchProtection,
    errors: warnings,
  };
}

async function crawlPerRepo<T>(
  repos: readonly RepoMeta[],
  fn: (repo: RepoMeta) => ResultAsync<T, GithubError>,
  warnings: CollectorWarning[],
  collector: string,
): Promise<T[]> {
  const results = await mapWithConcurrency(repos, 8, async (repo) => {
    const result = await fn(repo);
    return { repo, result };
  });
  const ok: T[] = [];
  for (const { repo, result } of results) {
    if (result.isOk()) {
      ok.push(result.value);
    } else {
      warnings.push({
        collector,
        repo: { owner: repo.owner, name: repo.name },
        message: formatGithubError(result.error),
      });
    }
  }
  return ok;
}

async function runResultAsync<T>(
  ra: ResultAsync<T, GithubError>,
  fallback: T,
  warnings: CollectorWarning[],
  collector: string,
): Promise<T> {
  const result = await ra;
  if (result.isOk()) return result.value;
  warnings.push({ collector, message: formatGithubError(result.error) });
  return fallback;
}

export type ParseCliResult = { kind: 'ok'; value: CliOptions } | { kind: 'err'; message: string };

const safeParseArgs = Result.fromThrowable(
  (argv: readonly string[]) =>
    parseArgs({
      args: [...argv],
      allowPositionals: true,
      options: {
        help: { type: 'boolean', default: false },
      },
    }),
  getErrorMessage,
);

export function parseCli(argv: readonly string[]): ParseCliResult {
  const parseResult = safeParseArgs(argv);
  if (parseResult.isErr()) {
    // strict parseArgs throws on any unknown --flag; surface it as a usage error.
    return { kind: 'err', message: `failed to parse arguments: ${parseResult.error}` };
  }
  const parsed = parseResult.value;
  if (parsed.values.help) return { kind: 'err', message: '' };

  if (parsed.positionals.length > 1) {
    return {
      kind: 'err',
      message: `expected a single org or user to scan, but got ${parsed.positionals.length}: ${parsed.positionals.join(' ')}`,
    };
  }

  return { kind: 'ok', value: { target: parsed.positionals[0] ?? null } };
}

function filterRepos(repos: RepoMeta[], opts: ResolvedOptions): RepoMeta[] {
  let out = repos.filter((r) => !r.archived && !r.fork);
  const includeSet = opts.include === null ? null : new Set(opts.include);
  const excludeSet = new Set(opts.exclude);
  if (includeSet !== null) out = out.filter((r) => includeSet.has(r.name));
  if (excludeSet.size > 0) out = out.filter((r) => !excludeSet.has(r.name));
  return out;
}

function usage(): string {
  return [
    '',
    'usage: patchwave-analysis [<org-or-user>]',
    '',
    'If <org-or-user> is omitted, you will be prompted for it.',
    '',
    'The report (a .html file and a .zip data bundle) is written to a temporary',
    'directory; the paths are printed when the scan finishes.',
    '',
    'options:',
    '  --help               show this help',
  ].join('\n');
}
