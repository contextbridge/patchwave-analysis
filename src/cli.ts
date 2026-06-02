import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { Result, ResultAsync } from 'neverthrow';
import pMap from 'p-map';
import { getCveAlerts, getOrgCveAlerts } from './collectors/cve.ts';
import { listDependabotPrs } from './collectors/dependabotPrs.ts';
import { probePrReadAccess } from './collectors/prReadProbe.ts';
import { listRepoMetadataBatched } from './collectors/repoMetadata.ts';
import { type TargetKind, listTargetRepos } from './collectors/repos.ts';
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
  PrAccess,
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

  // Resolve the repo list and confirm the token can actually read pull requests
  // before scanning — the GraphQL PR search silently returns nothing on a token
  // that can't see them, which would otherwise surface as a confident $0.
  const preflight = await runPreflight(ctx, opts);
  if (preflight.kind === 'list-failed') {
    ctx.prompter.error(formatGithubError(preflight.error));
    ctx.analytics.capture('run_failed', {
      error_kind: preflight.error.kind,
      duration_ms: elapsedMs(startedAt, ctx.clock.now()),
    });
    return { kind: 'failed', code: 1 };
  }
  if (preflight.kind === 'aborted') {
    ctx.analytics.capture('run_failed', {
      error_kind: 'pr-access-declined',
      duration_ms: elapsedMs(startedAt, ctx.clock.now()),
    });
    return { kind: 'failed', code: 1 };
  }

  const spinner = ctx.prompter.spinner();
  spinner.start(`Scanning ${opts.target} (last ${opts.windowDays} days)...`);

  const analyticsEmbed: ReportAnalyticsConfig = {
    telemetryDisabled: ctx.telemetryDisabled,
    reportId,
    generatedByAnonId: ctx.distinctId,
    version: ctx.appVersion,
  };

  const paths = resolveOutputPaths(opts.outBase);
  const renderResult = await renderReport(ctx, opts, analyticsEmbed, preflight);
  if (renderResult.isErr()) {
    const error = renderResult.error;
    spinner.stop('Scan failed.');
    ctx.prompter.error(error.message);
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
  if (preflight.prAccess === 'unreadable') {
    ctx.prompter.note(PR_ACCESS_INCOMPLETE_NOTE, 'Heads up');
  }
  ctx.analytics.capture('run_completed', {
    window_days: opts.windowDays,
    repos_total: stats.reposTotal,
    repos_included: stats.reposIncluded,
    dependabot_prs: stats.dependabotPrs,
    pr_access: preflight.prAccess,
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
  preflight: ReadyPreflight,
): ResultAsync<RenderedReport, RenderError> {
  const { repos, targetKind } = preflight;
  const filtered = filterRepos(repos, opts);
  ctx.logger.info(
    { total: repos.length, included: filtered.length },
    `found ${repos.length} repos; ${filtered.length} included after filters`,
  );
  const now = ctx.clock.now();
  const windowStart = now.subtract(Temporal.Duration.from({ hours: opts.windowDays * 24 }));

  return ResultAsync.fromSafePromise(
    collectAll(ctx, filtered, opts.target, targetKind, opts.windowDays, windowStart, now),
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
}

interface ReadyPreflight {
  readonly kind: 'ready';
  readonly repos: RepoMeta[];
  readonly targetKind: TargetKind;
  readonly prAccess: PrAccess;
}

type PreflightResult = ReadyPreflight | { kind: 'list-failed'; error: GithubError } | { kind: 'aborted' };

// Lists the target's repos once and checks the token can read pull requests.
// The Dependabot backlog comes from a GraphQL repo query whose pullRequests
// field stays empty when the token can't read PRs, so we probe a real repo's
// REST pulls endpoint (which does return 403/404) and let the user fix the
// token before a misleading $0.
async function runPreflight(ctx: Context, opts: ResolvedOptions): Promise<PreflightResult> {
  const { githubClient, prompter } = ctx;
  const listed = await listTargetRepos(githubClient, opts.target);
  if (listed.isErr()) return { kind: 'list-failed', error: listed.error };

  const { kind: targetKind, repos } = listed.value;
  const probeTarget = filterRepos(repos, opts)[0];
  if (!probeTarget) return { kind: 'ready', repos, targetKind, prAccess: 'ok' };

  const verdict = await probePrReadAccess(githubClient, { owner: probeTarget.owner, name: probeTarget.name });
  if (verdict.readable !== false) {
    return { kind: 'ready', repos, targetKind, prAccess: verdict.readable === true ? 'ok' : 'unknown' };
  }

  prompter.warn(PR_ACCESS_WARNING);
  const choice = await prompter
    .select<'stop' | 'continue'>({
      message: 'How do you want to proceed?',
      choices: [
        { value: 'stop', label: 'Stop and fix the token', hint: 'recommended' },
        { value: 'continue', label: 'Continue anyway', hint: 'PR backlog and cost will be incomplete' },
      ],
      initialValue: 'stop',
    })
    .unwrapOr('stop');
  if (choice === 'continue') return { kind: 'ready', repos, targetKind, prAccess: 'unreadable' };

  prompter.note(PR_ACCESS_FIX, 'Grant pull-request access');
  return { kind: 'aborted' };
}

const PR_ACCESS_WARNING =
  "This token can't read pull requests, so the Dependabot PR backlog (and the cost built on it) comes back empty.";

const PR_ACCESS_FIX = [
  'Give the token one of these, then run patchwave-analysis again:',
  '',
  '  • Fine-grained token: set "Pull requests" to Read-only',
  '  • Classic token: tick the "repo" scope',
].join('\n');

const PR_ACCESS_INCOMPLETE_NOTE = [
  "You continued without pull-request access, so the report's Dependabot backlog and cost are empty.",
  'Grant the token pull-request access and run it again for the full picture.',
].join('\n');

async function collectAll(
  ctx: Context,
  repos: RepoMeta[],
  target: string,
  targetKind: TargetKind,
  windowDays: number,
  windowStart: Instant,
  now: Instant,
): Promise<CollectedData> {
  const client = ctx.githubClient;
  const warnings: CollectorWarning[] = [];
  const windowStartIso = windowStart.toString();

  const cvePromise: Promise<CveSlice[]> = (async () => {
    const perRepoCrawl = (): Promise<CveSlice[]> =>
      crawlPerRepo<CveSlice>(repos, (r) => getCveAlerts(client, { owner: r.owner, name: r.name }), warnings, 'cve');
    if (targetKind === 'user') return perRepoCrawl();
    // Try the org-level endpoint first (one call instead of N). If anything
    // other than scope-missing comes back, fall back to per-repo so each
    // repo gets a real status determination instead of an empty list.
    const result = await getOrgCveAlerts(client, target, repos);
    if (result.isOk()) return result.value;
    warnings.push({ collector: 'cve', message: formatGithubError(result.error) });
    return perRepoCrawl();
  })();

  const [metadata, cve, dependabotPrs] = await Promise.all([
    runRepoMetadata(listRepoMetadataBatched(client, repos), warnings),
    cvePromise,
    runResultAsync<DependabotPr[]>(listDependabotPrs(client, repos, windowStartIso), [], warnings, 'dependabotPrs'),
  ]);

  return {
    ctx: { org: target, windowDays, windowStart, now },
    repos,
    dependabotConfig: metadata.dependabotConfig,
    dependabotPrs,
    cve,
    branchProtection: metadata.branchProtection,
    errors: warnings,
  };
}

async function crawlPerRepo<T>(
  repos: readonly RepoMeta[],
  fn: (repo: RepoMeta) => ResultAsync<T, GithubError>,
  warnings: CollectorWarning[],
  collector: string,
): Promise<T[]> {
  const results = await pMap(
    repos,
    async (repo) => {
      const result = await fn(repo);
      return { repo, result };
    },
    { concurrency: 8 },
  );
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

// listRepoMetadataBatched returns per-repo warnings inside the value; the outer
// Err channel is reserved for systemic errors and is currently unused. This
// helper forwards inner warnings up without double-counting and degrades to
// empty slices if the outer Err ever fires.
async function runRepoMetadata(
  ra: ReturnType<typeof listRepoMetadataBatched>,
  warnings: CollectorWarning[],
): Promise<{ dependabotConfig: DependabotConfigSlice[]; branchProtection: BranchProtectionSlice[] }> {
  const result = await ra;
  if (result.isErr()) {
    warnings.push({ collector: 'repoMetadata', message: formatGithubError(result.error) });
    return { dependabotConfig: [], branchProtection: [] };
  }
  for (const w of result.value.warnings) warnings.push(w);
  return { dependabotConfig: result.value.dependabotConfig, branchProtection: result.value.branchProtection };
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
