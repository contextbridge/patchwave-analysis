import type { Clock } from "./Clock.ts";
import { ClockImpl } from "./Clock.ts";
import type { FileSystem } from "./FileSystem.ts";
import { FileSystemImpl } from "./FileSystem.ts";
import type { GithubClient } from "./github/GithubClient.ts";
import { GithubClientImpl } from "./github/GithubClient.ts";
import type { Io } from "./BaseIo.ts";
import { IoImpl } from "./IoImpl.ts";

export interface Context {
  readonly io: Io;
  readonly clock: Clock;
  readonly fs: FileSystem;
  readonly githubClient: GithubClient;
}

export interface CreateContextOptions {
  readonly token: string;
  readonly io?: Io;
  readonly clock?: Clock;
  readonly fs?: FileSystem;
  readonly githubClient?: GithubClient;
}

export function createContext(options: CreateContextOptions): Context {
  const {
    token,
    io = new IoImpl(),
    clock = new ClockImpl(),
    fs = new FileSystemImpl(),
    githubClient = new GithubClientImpl({ token }),
  } = options;
  return { io, clock, fs, githubClient };
}
