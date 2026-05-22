import { parseArgs } from 'node:util';
import { ResultAsync } from 'neverthrow';
import pkg from '../package.json' with { type: 'json' };
import { getBranchProtection } from './collectors/branchProtection.ts';
import { listActiveCommitters } from './collectors/contributors.ts';
import { getCveAlerts } from './collectors/cve.ts';
import { getDependabotConfig } from './collectors/dependabotConfig.ts';
import { listDependabotPrs } from './collectors/dependabotPrs.ts';
import { getRepoLanguages, listOrgRepos } from './collectors/repos.ts';
import { indexDependabotPrsByRepo, listReverts } from './collectors/reverts.ts';
import { mapWithConcurrency } from './concurrency.ts';
import type { Context } from './context.ts';
import { formatFsError } from './FileSystem.ts';
import { type GithubError, formatGithubError } from './github/errors.ts';
import { type ReportBundle, aggregate } from './report/aggregate.ts';
import { type BundleMeta, buildBundleFiles, zipBundleFiles } from './report/bundle.ts';
import { renderMarkdown } from './report/markdown.ts';
import { type Instant, Temporal } from './time.ts';
import type {
  BranchProtectionSlice,
  CollectedData,
  CollectorWarning,
  ContributorSlice,
  CveSlice,
  DependabotConfigSlice,
  DependabotPr,
  RepoLanguages,
  RepoMeta,
  RepoRef,
  RevertEvent,
} from './types.ts';

export interface CliOptions {
  target: string;
  windowDays: number;
  outBase: string;
  include: string[] | null;
  exclude: string[];
}

export interface OutputPaths {
  readonly markdown: string;
  readonly zip: string;
}

export function resolveOutputPaths(outBase: string): OutputPaths {
  return { markdown: `${outBase}.md`, zip: `${outBase}.zip` };
}

export async function main(ctx: Context, argv: readonly string[]): Promise<number> {
  const parsed = parseCli(argv);
  if (parsed.kind === 'err') {
    if (parsed.message.length > 0) ctx.logger.error(parsed.message);
    // usage text is a multi-line reference document, not a log line — bypass pino.
    ctx.io.writeStderr(`${usage()}\n`);
    return parsed.message.length > 0 ? 1 : 0;
  }
  const opts = parsed.value;

  const startedAt = ctx.clock.now();
  ctx.analytics.capture('run_started', {
    window_days: opts.windowDays,
    has_include: opts.include !== null,
    has_exclude: opts.exclude.length > 0,
  });

  const renderResult = await renderReport(ctx, opts);
  if (renderResult.isErr()) {
    ctx.logger.error(formatGithubError(renderResult.error));
    ctx.analytics.capture('run_failed', {
      error_kind: renderResult.error.kind,
      duration_ms: elapsedMs(startedAt, ctx.clock.now()),
    });
    return 1;
  }

  const { report, collected, aggregated, stats } = renderResult.value;
  const paths = resolveOutputPaths(opts.outBase);

  const mdResult = await ctx.fs.writeTextFile(paths.markdown, report);
  if (mdResult.isErr()) {
    ctx.logger.error(formatFsError(mdResult.error));
    ctx.analytics.capture('run_failed', {
      error_kind: 'write-failed',
      duration_ms: elapsedMs(startedAt, ctx.clock.now()),
    });
    return 1;
  }

  const meta = buildBundleMeta(opts, stats, aggregated, collected);
  const files = buildBundleFiles({ meta, collected, aggregated, reportMarkdown: report });
  const zipResult = await ctx.fs.writeBinaryFile(paths.zip, zipBundleFiles(files));
  if (zipResult.isErr()) {
    ctx.logger.error(formatFsError(zipResult.error));
    ctx.analytics.capture('run_failed', {
      error_kind: 'write-failed',
      duration_ms: elapsedMs(startedAt, ctx.clock.now()),
    });
    return 1;
  }

  ctx.io.writeStdout(`wrote ${paths.markdown}\n`);
  ctx.io.writeStdout(`wrote ${paths.zip}\n`);
  ctx.analytics.capture('run_completed', {
    window_days: opts.windowDays,
    repos_total: stats.reposTotal,
    repos_included: stats.reposIncluded,
    dependabot_prs: stats.dependabotPrs,
    warnings: stats.warnings,
    duration_ms: elapsedMs(startedAt, ctx.clock.now()),
  });
  return 0;
}

function buildBundleMeta(
  opts: CliOptions,
  stats: ReportStats,
  aggregated: ReportBundle,
  collected: CollectedData,
): BundleMeta {
  return {
    cliVersion: pkg.version,
    generatedAt: aggregated.meta.generatedAt.toString(),
    target: opts.target,
    windowDays: opts.windowDays,
    windowStart: collected.ctx.windowStart.toString(),
    options: { include: opts.include, exclude: opts.exclude },
    counts: {
      reposTotal: stats.reposTotal,
      reposIncluded: stats.reposIncluded,
      dependabotPrs: stats.dependabotPrs,
      warnings: stats.warnings,
    },
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
  readonly collected: CollectedData;
  readonly aggregated: ReportBundle;
  readonly stats: ReportStats;
}

function elapsedMs(start: Instant, end: Instant): number {
  return Number(end.epochMilliseconds - start.epochMilliseconds);
}

function renderReport(ctx: Context, opts: CliOptions): ResultAsync<RenderedReport, GithubError> {
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

    return ResultAsync.fromSafePromise(collectAll(ctx, filtered, opts.target, opts.windowDays, windowStart, now)).map(
      (data): RenderedReport => {
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
        return {
          report: renderMarkdown(bundle),
          collected: data,
          aggregated: bundle,
          stats: {
            reposTotal: repos.length,
            reposIncluded: filtered.length,
            dependabotPrs: data.dependabotPrs.length,
            warnings: data.errors.length,
          },
        };
      },
    );
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

  const [languages, dependabotConfig, cve, branchProtection, contributors, dependabotPrs] = await Promise.all([
    crawlPerRepo(repos, (r) => getRepoLanguages(client, { owner: r.owner, name: r.name }), warnings, 'languages').then(
      (rows): RepoLanguages[] => rows.map((r) => ({ owner: r.ref.owner, name: r.ref.name, bytes: r.bytes })),
    ),
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
    crawlPerRepo<ContributorSlice>(
      repos,
      (r) => listActiveCommitters(client, { owner: r.owner, name: r.name }, windowStartIso),
      warnings,
      'contributors',
    ),
    runResultAsync<DependabotPr[]>(listDependabotPrs(client, target, windowStartIso), [], warnings, 'dependabotPrs'),
  ]);

  const prIndex = indexDependabotPrsByRepo(dependabotPrs);
  const revertGroups = await mapWithConcurrency(repos, 8, async (r) => {
    const numbers = prIndex.get(`${r.owner}/${r.name}`) ?? new Set<number>();
    return await runResultAsync<RevertEvent[]>(
      listReverts(client, { owner: r.owner, name: r.name }, windowStartIso, numbers),
      [],
      warnings,
      'reverts',
      { owner: r.owner, name: r.name },
    );
  });
  const reverts: RevertEvent[] = revertGroups.flat();

  return {
    ctx: { org: target, windowDays, windowStart, now },
    repos,
    languages,
    dependabotConfig,
    dependabotPrs,
    cve,
    reverts,
    branchProtection,
    contributors,
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
  repo?: RepoRef,
): Promise<T> {
  const result = await ra;
  if (result.isOk()) return result.value;
  warnings.push({ collector, repo, message: formatGithubError(result.error) });
  return fallback;
}

export type ParseCliResult = { kind: 'ok'; value: CliOptions } | { kind: 'err'; message: string };

export function parseCli(argv: readonly string[]): ParseCliResult {
  let parsed;
  try {
    parsed = parseArgs({
      args: [...argv],
      allowPositionals: true,
      options: {
        window: { type: 'string', default: '90d' },
        out: { type: 'string', default: './patchwave-report' },
        include: { type: 'string' },
        exclude: { type: 'string' },
        help: { type: 'boolean', default: false },
      },
    });
  } catch (e) {
    return { kind: 'err', message: `failed to parse arguments: ${(e as Error).message}` };
  }
  if (parsed.values.help) return { kind: 'err', message: '' };
  const positional = parsed.positionals;
  const target = positional[0];
  if (target === undefined) {
    return { kind: 'err', message: 'missing required argument: <org-or-user>' };
  }

  const windowDays = parseWindow(parsed.values.window);
  if (windowDays === null) {
    return { kind: 'err', message: `invalid --window: expected formats like '90d' or '12w'` };
  }

  return {
    kind: 'ok',
    value: {
      target,
      windowDays,
      outBase: normalizeOutBase(parsed.values.out),
      include: parsed.values.include ? splitCsv(parsed.values.include) : null,
      exclude: parsed.values.exclude ? splitCsv(parsed.values.exclude) : [],
    },
  };
}

function normalizeOutBase(out: string): string {
  return out.replace(/\.(md|zip)$/i, '');
}

function parseWindow(s: string): number | null {
  const match = /^(\d+)([dw])$/.exec(s.trim());
  if (!match) return null;
  const n = Number.parseInt(match[1] ?? '', 10);
  if (!Number.isFinite(n) || n <= 0) return null;
  return match[2] === 'w' ? n * 7 : n;
}

function splitCsv(s: string): string[] {
  return s
    .split(',')
    .map((v) => v.trim())
    .filter((v) => v.length > 0);
}

function filterRepos(repos: RepoMeta[], opts: CliOptions): RepoMeta[] {
  let out = repos.filter((r) => !r.archived);
  const includeSet = opts.include === null ? null : new Set(opts.include);
  const excludeSet = new Set(opts.exclude);
  if (includeSet !== null) out = out.filter((r) => includeSet.has(r.name));
  if (excludeSet.size > 0) out = out.filter((r) => !excludeSet.has(r.name));
  return out;
}

function usage(): string {
  return [
    '',
    'usage: patchwave-analysis <org-or-user> [options]',
    '',
    'options:',
    '  --window <Nd|Nw>     rolling time window (default 90d)',
    '  --out <basename>     output basename; writes <basename>.md and <basename>.zip',
    '                       (default ./patchwave-report)',
    '  --include <repos>    comma-separated repo names to include',
    '  --exclude <repos>    comma-separated repo names to exclude',
    '  --help               show this help',
  ].join('\n');
}
