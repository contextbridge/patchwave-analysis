import { ResultAsync } from 'neverthrow';
import { toError } from './errors.ts';

export type FsError = { kind: 'write-failed'; path: string; message: string };

export interface FileSystem {
  writeTextFile(path: string, contents: string): ResultAsync<void, FsError>;
  writeBinaryFile(path: string, contents: Uint8Array): ResultAsync<void, FsError>;
}

export class FileSystemImpl implements FileSystem {
  writeTextFile(path: string, contents: string): ResultAsync<void, FsError> {
    return this.write(path, contents);
  }

  writeBinaryFile(path: string, contents: Uint8Array): ResultAsync<void, FsError> {
    return this.write(path, contents);
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
  return `failed to write ${err.path}: ${err.message}`;
}
