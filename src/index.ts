#!/usr/bin/env bun
import { main } from "./cli.ts";

const code = await main(process.argv.slice(2));
process.exit(code);
