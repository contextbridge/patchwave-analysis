import { BaseIo } from '../BaseIo.ts';
import { MemoryStream } from './MemoryStream.ts';

export interface FakeIoOptions {
  /**
   * What `isTty()` should return. Defaults to `true` so newly written
   * tests exercise the interactive path; flip to `false` to assert the
   * "requires a terminal" gate.
   */
  readonly isTty?: boolean;
}

export class FakeIo extends BaseIo {
  declare readonly stdout: MemoryStream;
  declare readonly stderr: MemoryStream;

  constructor(options: FakeIoOptions = {}) {
    super({
      stdout: new MemoryStream(),
      stderr: new MemoryStream(),
      isTty: options.isTty ?? true,
    });
  }
}
