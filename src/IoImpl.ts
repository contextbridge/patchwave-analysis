import { BaseIo, type Writer } from "./BaseIo.ts";

export type { Io, Writer } from "./BaseIo.ts";

export interface IoImplOptions {
  readonly stdout?: Writer;
  readonly stderr?: Writer;
}

export class IoImpl extends BaseIo {
  constructor(options: IoImplOptions = {}) {
    // The one place that touches the real process streams — everything downstream
    // receives them through ctx.io.
    const { stdout = process.stdout, stderr = process.stderr } = options;
    super({ stdout, stderr });
  }
}
