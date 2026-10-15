import { type GithubClient, GithubClientImpl } from '../github/GithubClient.ts';
import { type Analytics, NoopAnalytics } from '../telemetry/Analytics.ts';
import type { Io } from './BaseIo.ts';
import { type BrowserOpener, BrowserOpenerImpl } from './BrowserOpener.ts';
import { type Clock, ClockImpl } from './Clock.ts';
import { type Environment, getEnvironment } from './Environment.ts';
import { type FileSystem, FileSystemImpl } from './FileSystem.ts';
import { IoImpl } from './IoImpl.ts';
import { type Logger, createLogger } from './Logger.ts';
import { type Prompter, PrompterImpl } from './Prompter.ts';

export interface Context {
  readonly io: Io;
  readonly logger: Logger;
  readonly env: Environment;
  readonly clock: Clock;
  readonly fs: FileSystem;
  readonly githubClient: GithubClient;
  readonly analytics: Analytics;
  readonly prompter: Prompter;
  readonly browserOpener: BrowserOpener;
}

type CreateContextOptions = Partial<Context> & {
  readonly token?: string;
};

export function createContext(options: CreateContextOptions = {}): Context {
  const {
    token = '',
    io = new IoImpl(),
    env = getEnvironment(),
    logger = createLogger({ level: env.LOG_LEVEL, destination: io.stderr }),
    clock = new ClockImpl(),
    fs = new FileSystemImpl(),
    githubClient = new GithubClientImpl({ token, logger }),
    analytics = new NoopAnalytics(),
    prompter = new PrompterImpl(),
    browserOpener = new BrowserOpenerImpl(),
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
    browserOpener,
  };
}
