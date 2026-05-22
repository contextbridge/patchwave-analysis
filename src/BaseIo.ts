import type { Writable } from 'node:stream';

export interface Writer extends Writable {
  readonly isTTY?: boolean;
}

export interface Io {
  /**
   * Raw stdout stream. Prefer `writeStdout(chunk)` — this field exists for
   * library adapters and tests that need stream-level access.
   */
  readonly stdout: Writer;
  /**
   * Raw stderr stream. Prefer `writeStderr(chunk)` — same rationale as stdout.
   */
  readonly stderr: Writer;
  writeStdout(chunk: string): void;
  writeStderr(chunk: string): void;
  isStdoutTty(): boolean;
}

export interface BaseIoOptions {
  readonly stdout: Writer;
  readonly stderr: Writer;
  readonly isStdoutTty?: boolean;
}

export abstract class BaseIo implements Io {
  readonly stdout: Writer;
  readonly stderr: Writer;
  readonly #isStdoutTty: boolean;

  protected constructor(options: BaseIoOptions) {
    this.stdout = options.stdout;
    this.stderr = options.stderr;
    this.#isStdoutTty = options.isStdoutTty ?? Boolean(options.stdout.isTTY);
  }

  writeStdout(chunk: string): void {
    this.stdout.write(chunk);
  }

  writeStderr(chunk: string): void {
    this.stderr.write(chunk);
  }

  isStdoutTty(): boolean {
    return this.#isStdoutTty;
  }
}
