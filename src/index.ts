#!/usr/bin/env bun
import { main } from "./cli.ts";
import { createContext } from "./context.ts";
import { formatAuthError, resolveToken } from "./github/auth.ts";
import { IoImpl } from "./IoImpl.ts";

const io = new IoImpl();
const tokenResult = await resolveToken();
if (tokenResult.isErr()) {
  io.writeStderr(`${formatAuthError(tokenResult.error)}\n`);
  process.exit(1);
}

const ctx = createContext({ token: tokenResult.value, io });
const code = await main(ctx, process.argv.slice(2));
process.exit(code);
