import type { Context } from "../context.ts";
import { FakeClock } from "./FakeClock.ts";
import { FakeFileSystem } from "./FakeFileSystem.ts";
import { FakeGithubClient } from "./FakeGithubClient.ts";
import { FakeIo } from "./FakeIo.ts";

export interface FakeContextHandle {
  readonly ctx: Context;
  readonly io: FakeIo;
  readonly clock: FakeClock;
  readonly fs: FakeFileSystem;
  readonly githubClient: FakeGithubClient;
}

export function createFakeContext(overrides: Partial<Context> = {}): FakeContextHandle {
  const io = new FakeIo();
  const clock = new FakeClock();
  const fs = new FakeFileSystem();
  const githubClient = new FakeGithubClient();

  const ctx: Context = { io, clock, fs, githubClient, ...overrides };

  return {
    ctx,
    io: ctx.io instanceof FakeIo ? ctx.io : io,
    clock: ctx.clock instanceof FakeClock ? ctx.clock : clock,
    fs: ctx.fs instanceof FakeFileSystem ? ctx.fs : fs,
    githubClient:
      ctx.githubClient instanceof FakeGithubClient ? ctx.githubClient : githubClient,
  };
}
