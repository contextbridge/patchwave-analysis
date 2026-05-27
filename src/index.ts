#!/usr/bin/env bun
import pkg from '../package.json' with { type: 'json' };
import { type Analytics, NoopAnalytics } from './Analytics.ts';
import { getOrCreateAnonymousId } from './anonymousId.ts';
import { POSTHOG_KEY, SENTRY_DSN } from './buildInfo.ts';
import { main, parseCli } from './cli.ts';
import { createContext } from './context.ts';
import { getEnvironment, isTelemetryDisabled } from './environment.ts';
import { welcomeBannerBody, welcomeBannerTitle } from './interactive/banner.ts';
import { openReport } from './interactive/openReport.ts';
import { runSharePrompt } from './interactive/sharePrompt.ts';
import { formatInteractiveTokenError, interactiveResolveToken } from './interactive/tokenWalkthrough.ts';
import { enforceTty } from './interactive/ttyGate.ts';
import { IoImpl } from './IoImpl.ts';
import { createLogger } from './logger.ts';
import { AnalyticsImpl } from './PostHogAnalytics.ts';
import { PrompterImpl } from './prompt/Prompter.ts';
import { NoopTelemetry, type Telemetry, createSentryTelemetry } from './Telemetry.ts';
import { UploaderImpl } from './upload/Uploader.ts';

const io = new IoImpl();
const env = getEnvironment();

const ttyGate = enforceTty(io);
if (!ttyGate.ok) process.exit(ttyGate.code);

const telemetryDisabled = isTelemetryDisabled(env);
const distinctId = telemetryDisabled ? '' : getOrCreateAnonymousId(env);

// Sentry.init must run before createLogger so its pinoIntegration subscribes to
// pino's diagnostics channel first. Sentry primarily captures uncaught
// exceptions (pino is silent by default below); an empty DSN — local/dev build
// or telemetry opt-out — disables it via NoopTelemetry.
const telemetry: Telemetry =
  telemetryDisabled || SENTRY_DSN === ''
    ? new NoopTelemetry()
    : createSentryTelemetry({ dsn: SENTRY_DSN, distinctId, version: pkg.version });

// In interactive mode we let Clack own the visual surface — pino chatter would
// interleave with prompts and spinners. Default to `silent` unless the user
// opted in explicitly with LOG_LEVEL.
const explicitLogLevel = process.env['LOG_LEVEL'] !== undefined;
const logLevel = explicitLogLevel ? env.LOG_LEVEL : 'silent';
const logger = createLogger({ level: logLevel, destination: io.stderr });

// An empty key means PostHog wasn't built in; skip it so we never initialize the
// client with ''. Mirrors the Sentry gate above.
const analytics: Analytics =
  telemetryDisabled || POSTHOG_KEY === ''
    ? new NoopAnalytics()
    : new AnalyticsImpl({ distinctId, version: pkg.version });
if (!telemetryDisabled && POSTHOG_KEY !== '') analytics.identify(distinctId);

async function shutdown(): Promise<void> {
  await Promise.all([analytics.shutdown(), telemetry.flush()]);
}

const argv = process.argv.slice(2);
const prompter = new PrompterImpl();
const isFullRun = parseCli(argv).kind === 'ok';

let token = '';
if (isFullRun) {
  prompter.intro(welcomeBannerTitle());
  prompter.note(welcomeBannerBody(), 'What this is');

  const tokenResult = await interactiveResolveToken({ prompter });
  if (tokenResult.isErr()) {
    prompter.error(formatInteractiveTokenError(tokenResult.error));
    await shutdown();
    process.exit(1);
  }
  token = tokenResult.value;
}

const ctx = createContext({
  token,
  appVersion: pkg.version,
  io,
  env,
  logger,
  analytics,
  prompter,
  uploader: new UploaderImpl(),
  distinctId,
  telemetryDisabled,
});

const result = await main(ctx, argv);

if (result.kind === 'completed') {
  await openReport({ context: ctx, htmlPath: result.run.paths.html });
  await runSharePrompt({
    context: ctx,
    target: result.run.target,
    htmlPath: result.run.paths.html,
    htmlContent: result.run.html,
  });
}

await shutdown();
process.exit(result.code);
