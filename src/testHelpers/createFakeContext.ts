import pino from 'pino';
import type { Context } from '../context.ts';
import type { Environment } from '../environment.ts';
import type { Logger } from '../logger.ts';
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
}

const defaultEnv: Environment = { LOG_LEVEL: 'trace' };

export function createFakeContext(overrides: Partial<Context> = {}): FakeContextHandle {
  const io = new FakeIo();
  const clock = new FakeClock();
  const fs = new FakeFileSystem();
  const githubClient = new FakeGithubClient();

  // Route fake logger output to FakeIo.stderr (raw pino JSON, no pino-pretty) so
  // tests can substring-match log content via io.stderr.text().
  const logger: Logger = pino({ level: 'trace' }, io.stderr);

  const ctx: Context = {
    io,
    logger,
    env: defaultEnv,
    clock,
    fs,
    githubClient,
    ...overrides,
  };

  return {
    ctx,
    io: ctx.io instanceof FakeIo ? ctx.io : io,
    logger: ctx.logger,
    clock: ctx.clock instanceof FakeClock ? ctx.clock : clock,
    fs: ctx.fs instanceof FakeFileSystem ? ctx.fs : fs,
    githubClient: ctx.githubClient instanceof FakeGithubClient ? ctx.githubClient : githubClient,
  };
}
