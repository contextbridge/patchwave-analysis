import { ResultAsync, errAsync, okAsync } from 'neverthrow';
import type { FileSystem, FsError } from '../FileSystem.ts';

export interface FakeWrite {
  readonly path: string;
  readonly contents: string;
}

export class FakeFileSystem implements FileSystem {
  readonly writes: FakeWrite[] = [];
  readonly tempDirs: string[] = [];
  private failure: FsError | null = null;
  private tempDirFailure: FsError | null = null;
  private tempDirCounter = 0;

  failNextWriteWith(err: FsError): void {
    this.failure = err;
  }

  failNextTempDirWith(err: FsError): void {
    this.tempDirFailure = err;
  }

  writeTextFile(path: string, contents: string): ResultAsync<void, FsError> {
    return this.recordWrite(path, contents);
  }

  makeTempDir(prefix: string): ResultAsync<string, FsError> {
    if (this.tempDirFailure) {
      const err = this.tempDirFailure;
      this.tempDirFailure = null;
      return errAsync(err);
    }
    const path = `/fake-tmp/${prefix}${this.tempDirCounter++}`;
    this.tempDirs.push(path);
    return okAsync(path);
  }

  read(path: string): string | undefined {
    return this.writes.find((w) => w.path === path)?.contents;
  }

  private recordWrite(path: string, contents: string): ResultAsync<void, FsError> {
    if (this.failure) {
      const err = this.failure;
      this.failure = null;
      return errAsync(err);
    }
    this.writes.push({ path, contents });
    return okAsync(undefined);
  }
}
