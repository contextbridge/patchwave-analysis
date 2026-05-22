import { ResultAsync, errAsync, okAsync } from 'neverthrow';
import type { FileSystem, FsError } from '../FileSystem.ts';

export interface FakeWrite {
  readonly path: string;
  readonly contents: string | Uint8Array;
}

export class FakeFileSystem implements FileSystem {
  readonly writes: FakeWrite[] = [];
  private failure: FsError | null = null;

  failNextWriteWith(err: FsError): void {
    this.failure = err;
  }

  writeTextFile(path: string, contents: string): ResultAsync<void, FsError> {
    return this.recordWrite(path, contents);
  }

  writeBinaryFile(path: string, contents: Uint8Array): ResultAsync<void, FsError> {
    return this.recordWrite(path, contents);
  }

  read(path: string): string | undefined {
    const contents = this.writes.find((w) => w.path === path)?.contents;
    return typeof contents === 'string' ? contents : undefined;
  }

  readBinary(path: string): Uint8Array | undefined {
    const contents = this.writes.find((w) => w.path === path)?.contents;
    return typeof contents === 'string' ? undefined : contents;
  }

  private recordWrite(path: string, contents: string | Uint8Array): ResultAsync<void, FsError> {
    if (this.failure) {
      const err = this.failure;
      this.failure = null;
      return errAsync(err);
    }
    this.writes.push({ path, contents });
    return okAsync(undefined);
  }
}
