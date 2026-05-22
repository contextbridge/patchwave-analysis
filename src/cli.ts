import { parseArgs } from 'node:util';
import { ResultAsync } from 'neverthrow';
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
import { aggregate } from './report/aggregate.ts';
import { renderMarkdown } from './report/markdown.ts';
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
  RevertEvent,
} from './types.ts';

export interface CliOptions {
  target: string;
  windowDays: number;
  out: string;
  include: string[] | null;
  exclude: string[];
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

  const renderResult = await renderReport(ctx, opts);
  if (renderResult.isErr()) {
    ctx.logger.error(formatGithubError(renderResult.error));
    return 1;
  }

  const writeResult = await ctx.fs.writeTextFile(opts.out, renderResult.value);
  if (writeResult.isErr()) {
    ctx.logger.error(formatFsError(writeResult.error));
    return 1;
  }

  ctx.io.writeStdout(`wrote ${opts.out}\n`);
  return 0;
}

function renderReport(ctx: Context, opts: CliOptions): ResultAsync<string, GithubError> {
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
    const windowStart = new Date(now.getTime() - opts.windowDays * 86_400_000);
    const windowStartIso = windowStart.toISOString();

    return ResultAsync.fromSafePromise(
      collectAll(ctx, filtered, opts.target, opts.windowDays, windowStartIso, now),
    ).map((data) => {
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
      return renderMarkdown(bundle);
    });
  });
}

async function collectAll(
  ctx: Context,
  repos: RepoMeta[],
  target: string,
  windowDays: number,
  windowStartIso: string,
  now: Date,
): Promise<CollectedData> {
  const client = ctx.githubClient;
  const warnings: CollectorWarning[] = [];

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
    const repoKey = `${r.owner}/${r.name}`;
    const numbers = prIndex.get(repoKey) ?? new Set<number>();
    return await runResultAsync<RevertEvent[]>(
      listReverts(client, { owner: r.owner, name: r.name }, windowStartIso, numbers),
      [],
      warnings,
      'reverts',
      repoKey,
    );
  });
  const reverts: RevertEvent[] = revertGroups.flat();

  return {
    ctx: { org: target, windowDays, windowStartIso, now },
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
        repo: `${repo.owner}/${repo.name}`,
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
  repo?: string,
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
        out: { type: 'string', default: './patchwave-report.md' },
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
      out: parsed.values.out,
      include: parsed.values.include ? splitCsv(parsed.values.include) : null,
      exclude: parsed.values.exclude ? splitCsv(parsed.values.exclude) : [],
    },
  };
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
    '  --out <path>         markdown destination (default ./patchwave-report.md)',
    '  --include <repos>    comma-separated repo names to include',
    '  --exclude <repos>    comma-separated repo names to exclude',
    '  --help               show this help',
  ].join('\n');
}
