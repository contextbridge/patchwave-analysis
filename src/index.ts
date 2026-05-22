#!/usr/bin/env bun
import { main } from './cli.ts';
import { createContext } from './context.ts';
import { getEnvironment } from './environment.ts';
import { formatAuthError, resolveToken } from './github/auth.ts';
import { IoImpl } from './IoImpl.ts';
import { createLogger } from './logger.ts';

const io = new IoImpl();
const env = getEnvironment();
const logger = createLogger({ level: env.LOG_LEVEL, destination: io.stderr });

const tokenResult = await resolveToken();
if (tokenResult.isErr()) {
  logger.error(formatAuthError(tokenResult.error));
  process.exit(1);
}

const ctx = createContext({ token: tokenResult.value, io, env, logger });
const code = await main(ctx, process.argv.slice(2));
process.exit(code);
