import { BaseIo } from "../BaseIo.ts";
import { MemoryStream } from "./MemoryStream.ts";

export class FakeIo extends BaseIo {
  declare readonly stdout: MemoryStream;
  declare readonly stderr: MemoryStream;

  constructor() {
    super({ stdout: new MemoryStream(), stderr: new MemoryStream() });
  }
}
