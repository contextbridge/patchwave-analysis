import type { Analytics } from './Analytics.ts';
import { NoopAnalytics } from './Analytics.ts';
import type { Io } from './BaseIo.ts';
import type { Clock } from './Clock.ts';
import { ClockImpl } from './Clock.ts';
import { type Environment, getEnvironment } from './environment.ts';
import type { FileSystem } from './FileSystem.ts';
import { FileSystemImpl } from './FileSystem.ts';
import type { GithubClient } from './github/GithubClient.ts';
import { GithubClientImpl } from './github/GithubClient.ts';
import { IoImpl } from './IoImpl.ts';
import { type Logger, createLogger } from './logger.ts';

export interface Context {
  readonly io: Io;
  readonly logger: Logger;
  readonly env: Environment;
  readonly clock: Clock;
  readonly fs: FileSystem;
  readonly githubClient: GithubClient;
  readonly analytics: Analytics;
}

export interface CreateContextOptions {
  readonly token: string;
  readonly io?: Io;
  readonly logger?: Logger;
  readonly env?: Environment;
  readonly clock?: Clock;
  readonly fs?: FileSystem;
  readonly githubClient?: GithubClient;
  readonly analytics?: Analytics;
}

export function createContext(options: CreateContextOptions): Context {
  const {
    token,
    io = new IoImpl(),
    env = getEnvironment(),
    clock = new ClockImpl(),
    fs = new FileSystemImpl(),
    analytics = new NoopAnalytics(),
  } = options;
  const logger = options.logger ?? createLogger({ level: env.LOG_LEVEL, destination: io.stderr });
  const githubClient = options.githubClient ?? new GithubClientImpl({ token, logger });
  return { io, logger, env, clock, fs, githubClient, analytics };
}
