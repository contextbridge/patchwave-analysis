import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { Result } from 'neverthrow';
import { listTargetRepos } from './collectors/repos.ts';
import { formatFsError } from './context/FileSystem.ts';
import type { Context } from './context/index.ts';
import { formatPromptError } from './context/Prompter.ts';
import { getErrorMessage } from './errors.ts';
import { formatGithubError } from './github/errors.ts';
import { checkTokenScopes } from './interactive/scopeGate.ts';
import { promptForTarget } from './interactive/targetPrompt.ts';
import { buildReport } from './report/buildReport.ts';
import type { ReportAnalyticsConfig } from './telemetry/Analytics.ts';
import type { Instant } from './time.ts';

// The CLI is intentionally flag-free (besides --help): the rolling window and
// output location are fixed.
const WINDOW_DAYS = 90;
const OUTPUT_BASENAME = 'patchwave-report';
const TEMP_DIR_PREFIX = 'patchwave-analysis-';

export interface CliOptions {
  /** `null` means the user didn't pass a positional target — `main()` will prompt for one. */
  readonly target: string | null;
}

export interface CompletedRun {
  readonly target: string;
  readonly htmlPath: string;
  readonly html: string;
}

export type MainResult =
  | { kind: 'usage'; code: number }
  | { kind: 'failed'; code: number }
  | { kind: 'completed'; code: 0; run: CompletedRun };

export async function main(ctx: Context, argv: readonly string[]): Promise<MainResult> {
  const { logger, io, clock, analytics, fs, prompter, githubClient, telemetryDisabled, anonymousId, appVersion } = ctx;

  const parsed = parseCli(argv);
  if (parsed.kind === 'err') {
    if (parsed.message.length > 0) logger.error(parsed.message);
    // usage text is a multi-line reference document, not a log line — bypass pino.
    io.writeStderr(`${usage()}\n`);
    return { kind: 'usage', code: parsed.message.length > 0 ? 1 : 0 };
  }

  const startedAt = clock.now();

  // One id per run, registered as a super-property so every CLI event carries it and joins to the
  // report-view events the frontend sends under the same pw_report_id.
  const reportId = crypto.randomUUID();
  analytics.register({ pw_report_id: reportId });

  const targetPrompted = parsed.value.target === null;
  const target = await resolveTarget(ctx, parsed.value.target);
  // resolveTarget already surfaced the failure; run_started hasn't fired yet.
  if (target === null) return { kind: 'failed', code: 1 };

  const tempDir = await fs.makeTempDir(TEMP_DIR_PREFIX);
  if (tempDir.isErr()) {
    prompter.error(formatFsError(tempDir.error));
    return failRun(ctx, startedAt, tempDir.error.kind);
  }
  const htmlPath = join(tempDir.value, `${OUTPUT_BASENAME}.html`);

  analytics.capture('run_started', { window_days: WINDOW_DAYS, target_prompted: targetPrompted });

  // Validate the token's scopes before scanning. A token that can't see private
  // repos would otherwise surface as a confident $0.
  const scopes = await checkTokenScopes(ctx);
  if (scopes.kind === 'list-failed') {
    prompter.error(formatGithubError(scopes.error));
    return failRun(ctx, startedAt, scopes.error.kind);
  }
  if (scopes.kind === 'insufficient') {
    return failRun(ctx, startedAt, 'token-scope-insufficient');
  }

  const listed = await listTargetRepos(githubClient, target);
  if (listed.isErr()) {
    prompter.error(formatGithubError(listed.error));
    return failRun(ctx, startedAt, listed.error.kind);
  }
  const { kind: targetKind, repos } = listed.value;

  const spinner = prompter.spinner();
  spinner.start(`Scanning ${target} (last ${WINDOW_DAYS} days)...`);

  const analyticsConfig: ReportAnalyticsConfig = {
    telemetryDisabled,
    reportId,
    generatedByAnonymousId: anonymousId,
    version: appVersion,
  };

  const rendered = await buildReport(ctx, {
    target,
    targetKind,
    repos,
    windowDays: WINDOW_DAYS,
    analytics: analyticsConfig,
  });
  if (rendered.isErr()) {
    spinner.stop('Scan failed.');
    prompter.error(rendered.error.message);
    return failRun(ctx, startedAt, rendered.error.kind);
  }
  const { report, stats } = rendered.value;

  const written = await fs.writeTextFile(htmlPath, report);
  if (written.isErr()) {
    spinner.stop('Scan failed.');
    prompter.error(formatFsError(written.error));
    return failRun(ctx, startedAt, 'write-failed');
  }

  spinner.stop(`Scanned ${target}.`);
  analytics.capture('run_completed', {
    window_days: WINDOW_DAYS,
    repos_total: stats.reposTotal,
    repos_included: stats.reposIncluded,
    dependabot_prs: stats.dependabotPrs,
    warnings: stats.warnings,
    duration_ms: elapsedMs(startedAt, clock.now()),
  });
  return { kind: 'completed', code: 0, run: { target, htmlPath, html: report } };
}

export type ParseCliResult = { kind: 'ok'; value: CliOptions } | { kind: 'err'; message: string };

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

// Resolves the scan target, prompting when none was passed. `null` means the
// prompt failed and the caller should bail (the error is already shown).
async function resolveTarget(ctx: Context, provided: string | null): Promise<string | null> {
  const { prompter, githubClient } = ctx;
  if (provided !== null) return provided;
  const result = await promptForTarget({ prompter, githubClient });
  if (result.isErr()) {
    prompter.error(`couldn't read target: ${formatPromptError(result.error)}`);
    return null;
  }
  return result.value;
}

function failRun(ctx: Context, startedAt: Instant, errorKind: string): MainResult {
  const { analytics, clock } = ctx;
  analytics.capture('run_failed', { error_kind: errorKind, duration_ms: elapsedMs(startedAt, clock.now()) });
  return { kind: 'failed', code: 1 };
}

function elapsedMs(start: Instant, end: Instant): number {
  return Number(end.epochMilliseconds - start.epochMilliseconds);
}

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

function usage(): string {
  return [
    '',
    'usage: patchwave-analysis [<org-or-user>]',
    '',
    'If <org-or-user> is omitted, you will be prompted for it.',
    '',
    'The report is written as a self-contained .html file in a temporary directory;',
    'its path is printed when the scan finishes.',
    '',
    'options:',
    '  --help               show this help',
  ].join('\n');
}
