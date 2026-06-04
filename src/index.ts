#!/usr/bin/env bun
import pkg from '../package.json' with { type: 'json' };
import { POSTHOG_KEY, SENTRY_DSN } from './buildInfo.ts';
import { main, parseCli } from './cli.ts';
import { getEnvironment } from './context/Environment.ts';
import { createContext } from './context/index.ts';
import { IoImpl } from './context/IoImpl.ts';
import { createLogger } from './context/Logger.ts';
import { PrompterImpl } from './context/Prompter.ts';
import { UploaderImpl } from './context/Uploader.ts';
import { welcomeBannerBody, welcomeBannerTitle } from './interactive/banner.ts';
import { openReport } from './interactive/openReport.ts';
import { runSharePrompt, shouldRequestReportShare, showLocalReportReadyNotice } from './interactive/sharePrompt.ts';
import { formatInteractiveTokenError, interactiveResolveToken } from './interactive/tokenWalkthrough.ts';
import { enforceTty } from './interactive/ttyGate.ts';
import { type Analytics, NoopAnalytics } from './telemetry/Analytics.ts';
import { AnalyticsImpl, getOrCreateAnonymousId } from './telemetry/PostHogAnalytics.ts';
import { NoopTelemetry, type Telemetry, createSentryTelemetry, isTelemetryDisabled } from './telemetry/Telemetry.ts';

const io = new IoImpl();
const env = getEnvironment();

const ttyGate = enforceTty(io);
if (!ttyGate.ok) process.exit(ttyGate.code);

const telemetryDisabled = isTelemetryDisabled(env);
const anonymousId = telemetryDisabled ? '' : getOrCreateAnonymousId(env);

// Sentry.init must run before createLogger so its pinoIntegration subscribes to
// pino's diagnostics channel first. Sentry primarily captures uncaught
// exceptions (pino is silent by default below); an empty DSN — local/dev build
// or telemetry opt-out — disables it via NoopTelemetry.
const telemetry: Telemetry =
  telemetryDisabled || SENTRY_DSN === ''
    ? new NoopTelemetry()
    : createSentryTelemetry({ dsn: SENTRY_DSN, anonymousId, version: pkg.version });

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
    : new AnalyticsImpl({ anonymousId, version: pkg.version });
if (!telemetryDisabled && POSTHOG_KEY !== '') analytics.identify(anonymousId);

async function shutdown(): Promise<void> {
  await Promise.all([analytics.shutdown(), telemetry.flush()]);
}

// Business logic returns Results, so a throw here is an unexpected bug. Route it
// through `logger.error` (pino -> Sentry) so it's always reported, and flush
// telemetry before exiting so the report actually goes out.
async function crash(err: unknown): Promise<never> {
  logger.error({ err }, 'unexpected crash');
  io.writeStderr('\nSomething went wrong. The error has been reported.\n');
  await shutdown();
  process.exit(1);
}

// Backstop for anything thrown outside the main try/catch (e.g. a stray async callback).
process.on('uncaughtException', (err) => void crash(err));
process.on('unhandledRejection', (reason) => void crash(reason));

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
  anonymousId,
  telemetryDisabled,
});

try {
  const result = await main(ctx, argv);

  if (result.kind === 'completed') {
    await openReport({ context: ctx, htmlPath: result.run.htmlPath });
    if (shouldRequestReportShare(ctx)) {
      await runSharePrompt({
        context: ctx,
        target: result.run.target,
        htmlPath: result.run.htmlPath,
        htmlContent: result.run.html,
      });
    } else {
      showLocalReportReadyNotice({
        context: ctx,
        target: result.run.target,
        htmlPath: result.run.htmlPath,
      });
    }
  }

  await shutdown();
  process.exit(result.code);
} catch (err) {
  await crash(err);
}
