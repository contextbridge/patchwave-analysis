import { BaseIo, type Writer } from './BaseIo.ts';

export type { Io, Writer } from './BaseIo.ts';

export interface IoImplOptions {
  readonly stdout?: Writer;
  readonly stderr?: Writer;
}

export class IoImpl extends BaseIo {
  constructor(options: IoImplOptions = {}) {
    // The one place that touches the real process streams — everything downstream
    // receives them through ctx.io.
    /* eslint-disable no-restricted-properties */
    const { stdout = process.stdout, stderr = process.stderr } = options;
    const isTty = Boolean(process.stdin.isTTY && stdout.isTTY);
    /* eslint-enable no-restricted-properties */
    super({ stdout, stderr, isTty });
  }
}
