import type { GithubClient } from '../github/GithubClient.ts';
import { GithubClientImpl } from '../github/GithubClient.ts';
import { type Analytics, NoopAnalytics } from '../telemetry/Analytics.ts';
import { isTelemetryDisabled } from '../telemetry/Telemetry.ts';
import type { Io } from './BaseIo.ts';
import type { BrowserOpener } from './BrowserOpener.ts';
import { BrowserOpenerImpl } from './BrowserOpener.ts';
import type { Clock } from './Clock.ts';
import { ClockImpl } from './Clock.ts';
import { type Environment, getEnvironment } from './Environment.ts';
import type { FileSystem } from './FileSystem.ts';
import { FileSystemImpl } from './FileSystem.ts';
import { IoImpl } from './IoImpl.ts';
import { type Logger, createLogger } from './Logger.ts';
import type { Prompter } from './Prompter.ts';
import { PrompterImpl } from './Prompter.ts';
import type { Uploader } from './Uploader.ts';
import { UploaderImpl } from './Uploader.ts';

export interface Context {
  readonly io: Io;
  readonly logger: Logger;
  readonly env: Environment;
  readonly clock: Clock;
  readonly fs: FileSystem;
  readonly githubClient: GithubClient;
  readonly analytics: Analytics;
  readonly prompter: Prompter;
  readonly uploader: Uploader;
  readonly browserOpener: BrowserOpener;
  readonly appVersion: string;
  // Anonymous telemetry id of this machine ('' when telemetry is disabled). Embedded into the
  // report so report-view events can be tied back to the run that produced them.
  readonly anonymousId: string;
  readonly telemetryDisabled: boolean;
}

type CreateContextOptions = Partial<Context> & {
  readonly token?: string;
};

export function createContext(options: CreateContextOptions = {}): Context {
  const {
    token = '',
    appVersion = '0.0.0',
    io = new IoImpl(),
    env = getEnvironment(),
    logger = createLogger({ level: env.LOG_LEVEL, destination: io.stderr }),
    clock = new ClockImpl(),
    fs = new FileSystemImpl(),
    githubClient = new GithubClientImpl({ token, logger }),
    analytics = new NoopAnalytics(),
    prompter = new PrompterImpl(),
    uploader = new UploaderImpl(),
    browserOpener = new BrowserOpenerImpl(),
    anonymousId = '',
    telemetryDisabled = isTelemetryDisabled(env),
  } = options;

  return {
    io,
    logger,
    env,
    clock,
    fs,
    githubClient,
    analytics,
    prompter,
    uploader,
    browserOpener,
    appVersion,
    anonymousId,
    telemetryDisabled,
  };
}
