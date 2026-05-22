#!/usr/bin/env bun
import pkg from '../package.json' with { type: 'json' };
import { type Analytics, AnalyticsImpl, NoopAnalytics } from './Analytics.ts';
import { getOrCreateAnonymousId } from './anonymousId.ts';
import { main } from './cli.ts';
import { createContext } from './context.ts';
import { getEnvironment, isTelemetryDisabled } from './environment.ts';
import { formatAuthError, resolveToken } from './github/auth.ts';
import { IoImpl } from './IoImpl.ts';
import { createLogger } from './logger.ts';

const io = new IoImpl();
const env = getEnvironment();
const logger = createLogger({ level: env.LOG_LEVEL, destination: io.stderr });

const telemetryDisabled = isTelemetryDisabled(env);
const distinctId = telemetryDisabled ? '' : getOrCreateAnonymousId(env);
const analytics: Analytics = telemetryDisabled
  ? new NoopAnalytics()
  : new AnalyticsImpl({ distinctId, version: pkg.version });
if (!telemetryDisabled) analytics.identify(distinctId);

const tokenResult = await resolveToken();
if (tokenResult.isErr()) {
  logger.error(formatAuthError(tokenResult.error));
  await analytics.shutdown();
  process.exit(1);
}

const ctx = createContext({ token: tokenResult.value, io, env, logger, analytics });
const code = await main(ctx, process.argv.slice(2));
await analytics.shutdown();
process.exit(code);
