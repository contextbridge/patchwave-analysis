import { $ } from 'bun';
import { ResultAsync, errAsync, okAsync } from 'neverthrow';
import { getErrorMessage } from '../errors.ts';

export type AuthError = { kind: 'no-token'; message: string } | { kind: 'gh-failed'; message: string };

export function resolveToken(): ResultAsync<string, AuthError> {
  const envToken = (Bun.env.GITHUB_TOKEN ?? Bun.env.GH_TOKEN ?? '').trim();
  if (envToken.length > 0) return okAsync(envToken);

  return ResultAsync.fromPromise(
    $`gh auth token`.quiet().text(),
    (e): AuthError => ({ kind: 'gh-failed', message: getErrorMessage(e) }),
  ).andThen((raw) => {
    const token = raw.trim();
    if (token.length === 0) {
      return errAsync<string, AuthError>({
        kind: 'no-token',
        message: 'gh auth token returned an empty string',
      });
    }
    return okAsync<string, AuthError>(token);
  });
}

export function formatAuthError(err: AuthError): string {
  switch (err.kind) {
    case 'no-token':
      return `no GitHub token available.\n  fix: set GITHUB_TOKEN, or run 'gh auth login' to use the gh CLI`;
    case 'gh-failed':
      return `failed to read token from gh CLI: ${err.message}\n  fix: set GITHUB_TOKEN, or run 'gh auth login'`;
  }
}
