import pino from 'pino';
import type { Context } from '../context.ts';
import type { Environment } from '../environment.ts';
import type { Logger } from '../logger.ts';
import { FakeAnalytics } from './FakeAnalytics.ts';
import { FakeBrowserOpener } from './FakeBrowserOpener.ts';
import { FakeClock } from './FakeClock.ts';
import { FakeFileSystem } from './FakeFileSystem.ts';
import { FakeGithubClient } from './FakeGithubClient.ts';
import { FakeIo, type FakeIoOptions } from './FakeIo.ts';
import { FakePrompter } from './FakePrompter.ts';
import { FakeUploader } from './FakeUploader.ts';

export interface FakeContextHandle {
  readonly ctx: Context;
  readonly io: FakeIo;
  readonly logger: Logger;
  readonly clock: FakeClock;
  readonly fs: FakeFileSystem;
  readonly githubClient: FakeGithubClient;
  readonly analytics: FakeAnalytics;
  readonly prompter: FakePrompter;
  readonly uploader: FakeUploader;
  readonly browserOpener: FakeBrowserOpener;
}

export interface CreateFakeContextOptions {
  readonly overrides?: Partial<Context>;
  readonly io?: FakeIoOptions;
}

const defaultEnv: Environment = {
  LOG_LEVEL: 'trace',
  DO_NOT_TRACK: false,
  CONTEXTBRIDGE_TELEMETRY_DISABLED: false,
  CI: false,
};

export function createFakeContext(options: CreateFakeContextOptions = {}): FakeContextHandle {
  const io = new FakeIo(options.io);
  const clock = new FakeClock();
  const fs = new FakeFileSystem();
  const githubClient = new FakeGithubClient();
  const analytics = new FakeAnalytics();
  const prompter = new FakePrompter();
  const uploader = new FakeUploader();
  const browserOpener = new FakeBrowserOpener();

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
    analytics,
    prompter,
    uploader,
    browserOpener,
    appVersion: '0.0.0-test',
    distinctId: 'fake-anon-id',
    telemetryDisabled: false,
    ...options.overrides,
  };

  return {
    ctx,
    io: ctx.io instanceof FakeIo ? ctx.io : io,
    logger: ctx.logger,
    clock: ctx.clock instanceof FakeClock ? ctx.clock : clock,
    fs: ctx.fs instanceof FakeFileSystem ? ctx.fs : fs,
    githubClient: ctx.githubClient instanceof FakeGithubClient ? ctx.githubClient : githubClient,
    analytics: ctx.analytics instanceof FakeAnalytics ? ctx.analytics : analytics,
    prompter: ctx.prompter instanceof FakePrompter ? ctx.prompter : prompter,
    uploader: ctx.uploader instanceof FakeUploader ? ctx.uploader : uploader,
    browserOpener: ctx.browserOpener instanceof FakeBrowserOpener ? ctx.browserOpener : browserOpener,
  };
}
