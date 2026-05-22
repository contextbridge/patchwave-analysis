import { ResultAsync } from "neverthrow";
import { toError } from "../errors.ts";

export type FsError = { kind: "write-failed"; path: string; message: string };

export function writeTextFile(path: string, contents: string): ResultAsync<void, FsError> {
  return ResultAsync.fromPromise(
    Bun.write(path, contents).then(() => undefined),
    (e): FsError => ({
      kind: "write-failed",
      path,
      message: toError(e).message,
    }),
  );
}

export function formatFsError(err: FsError): string {
  return `failed to write ${err.path}: ${err.message}`;
}
