import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ResultAsync } from 'neverthrow';
import { toError } from './errors.ts';

export type FsError =
  | { kind: 'write-failed'; path: string; message: string }
  | { kind: 'temp-dir-failed'; message: string };

export interface FileSystem {
  writeTextFile(path: string, contents: string): ResultAsync<void, FsError>;
  writeBinaryFile(path: string, contents: Uint8Array): ResultAsync<void, FsError>;
  /** Create a fresh, uniquely named directory under the OS temp dir and return its path. */
  makeTempDir(prefix: string): ResultAsync<string, FsError>;
}

export class FileSystemImpl implements FileSystem {
  writeTextFile(path: string, contents: string): ResultAsync<void, FsError> {
    return this.write(path, contents);
  }

  writeBinaryFile(path: string, contents: Uint8Array): ResultAsync<void, FsError> {
    return this.write(path, contents);
  }

  makeTempDir(prefix: string): ResultAsync<string, FsError> {
    return ResultAsync.fromPromise(
      mkdtemp(join(tmpdir(), prefix)),
      (e): FsError => ({ kind: 'temp-dir-failed', message: toError(e).message }),
    );
  }

  private write(path: string, contents: string | Uint8Array): ResultAsync<void, FsError> {
    return ResultAsync.fromPromise(
      Bun.write(path, contents).then(() => undefined),
      (e): FsError => ({
        kind: 'write-failed',
        path,
        message: toError(e).message,
      }),
    );
  }
}

export function formatFsError(err: FsError): string {
  switch (err.kind) {
    case 'write-failed':
      return `failed to write ${err.path}: ${err.message}`;
    case 'temp-dir-failed':
      return `failed to create a temporary output directory: ${err.message}`;
  }
}
