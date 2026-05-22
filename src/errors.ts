export function toError(err: unknown): Error {
  return err instanceof Error ? err : new Error(String(err));
}

export function getErrorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
