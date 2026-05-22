import { okAsync, ResultAsync } from "neverthrow";
import type { FileSystem, FsError } from "../FileSystem.ts";

export interface FakeWrite {
  readonly path: string;
  readonly contents: string;
}

export class FakeFileSystem implements FileSystem {
  readonly writes: FakeWrite[] = [];
  private failure: FsError | null = null;

  failNextWriteWith(err: FsError): void {
    this.failure = err;
  }

  writeTextFile(path: string, contents: string): ResultAsync<void, FsError> {
    if (this.failure) {
      const err = this.failure;
      this.failure = null;
      return ResultAsync.fromPromise(Promise.reject(err), () => err);
    }
    this.writes.push({ path, contents });
    return okAsync(undefined);
  }

  read(path: string): string | undefined {
    return this.writes.find((w) => w.path === path)?.contents;
  }
}
