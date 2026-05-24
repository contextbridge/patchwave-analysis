#!/usr/bin/env bun
import pkg from '../package.json' with { type: 'json' };
import { type Analytics, AnalyticsImpl, NoopAnalytics } from './Analytics.ts';
import { getOrCreateAnonymousId } from './anonymousId.ts';
import { main, parseCli } from './cli.ts';
import { createContext } from './context.ts';
import { getEnvironment, isTelemetryDisabled } from './environment.ts';
import { welcomeBannerBody, welcomeBannerTitle } from './interactive/banner.ts';
import { runOpenReportPrompt } from './interactive/openReportPrompt.ts';
import { runSharePrompt } from './interactive/sharePrompt.ts';
import { formatInteractiveTokenError, interactiveResolveToken } from './interactive/tokenWalkthrough.ts';
import { enforceTty } from './interactive/ttyGate.ts';
import { IoImpl } from './IoImpl.ts';
import { createLogger } from './logger.ts';
import { PrompterImpl } from './prompt/Prompter.ts';
import { UploaderImpl } from './upload/Uploader.ts';

const io = new IoImpl();
const env = getEnvironment();

// In interactive mode we let Clack own the visual surface — pino chatter would
// interleave with prompts and spinners. Default to `silent` unless the user
// opted in explicitly with LOG_LEVEL.
const explicitLogLevel = process.env['LOG_LEVEL'] !== undefined;
const logLevel = explicitLogLevel ? env.LOG_LEVEL : 'silent';
const logger = createLogger({ level: logLevel, destination: io.stderr });

const ttyGate = enforceTty(io);
if (!ttyGate.ok) process.exit(ttyGate.code);

const telemetryDisabled = isTelemetryDisabled(env);
const distinctId = telemetryDisabled ? '' : getOrCreateAnonymousId(env);
const analytics: Analytics = telemetryDisabled
  ? new NoopAnalytics()
  : new AnalyticsImpl({ distinctId, version: pkg.version });
if (!telemetryDisabled) analytics.identify(distinctId);

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
    await analytics.shutdown();
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
});

const result = await main(ctx, argv);

if (result.kind === 'completed') {
  const identifier = distinctId.length > 0 ? distinctId : 'anonymous';
  await runOpenReportPrompt({ context: ctx, htmlPath: result.run.paths.html });
  await runSharePrompt({
    context: ctx,
    target: result.run.target,
    htmlPath: result.run.paths.html,
    zipPath: result.run.paths.zip,
    htmlContent: result.run.html,
    zipBytes: result.run.zipBytes,
    identifier,
  });
}

await analytics.shutdown();
process.exit(result.code);
