import pino from 'pino';
import type { Context } from '../context.ts';
import type { Environment } from '../environment.ts';
import type { Logger } from '../logger.ts';
import { FakeAnalytics } from './FakeAnalytics.ts';
import { FakeClock } from './FakeClock.ts';
import { FakeFileSystem } from './FakeFileSystem.ts';
import { FakeGithubClient } from './FakeGithubClient.ts';
import { FakeIo } from './FakeIo.ts';

export interface FakeContextHandle {
  readonly ctx: Context;
  readonly io: FakeIo;
  readonly logger: Logger;
  readonly clock: FakeClock;
  readonly fs: FakeFileSystem;
  readonly githubClient: FakeGithubClient;
  readonly analytics: FakeAnalytics;
}

const defaultEnv: Environment = {
  LOG_LEVEL: 'trace',
  DO_NOT_TRACK: false,
  CONTEXTBRIDGE_TELEMETRY_DISABLED: false,
  CI: false,
};

export function createFakeContext(): FakeContextHandle {
  const io = new FakeIo();
  const clock = new FakeClock();
  const fs = new FakeFileSystem();
  const githubClient = new FakeGithubClient();
  const analytics = new FakeAnalytics();

  // Route fake logger output to FakeIo.stderr (raw pino JSON, no pino-pretty) so
  // tests can substring-match log content via io.stderr.text().
  const logger: Logger = pino({ level: 'trace' }, io.stderr);

  const ctx: Context = { io, logger, env: defaultEnv, clock, fs, githubClient, analytics };

  return { ctx, io, logger, clock, fs, githubClient, analytics };
}
