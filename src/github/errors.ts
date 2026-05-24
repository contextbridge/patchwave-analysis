import { getErrorMessage } from '../errors.ts';

export type GithubError =
  | { kind: 'network'; message: string; cause: Error }
  | { kind: 'not-found'; url?: string; message: string }
  | { kind: 'scope-missing'; required: string; message: string }
  | { kind: 'forbidden'; url?: string; message: string }
  | { kind: 'http'; status: number; url?: string; message: string };

interface RequestErrorLike {
  status?: number;
  message?: string;
  request?: { url?: string };
  response?: { headers?: Record<string, string | undefined> };
}

export function toGithubError(err: unknown): GithubError {
  const e = err as RequestErrorLike & Error;
  const url = e?.request?.url;
  const status = typeof e?.status === 'number' ? e.status : undefined;
  const message = getErrorMessage(err);

  if (status === undefined) {
    return { kind: 'network', message, cause: err instanceof Error ? err : new Error(message) };
  }

  if (status === 404) return { kind: 'not-found', url, message };

  if (status === 403) {
    const required = detectMissingScope(e);
    if (required) {
      return {
        kind: 'scope-missing',
        required,
        message: `GitHub returned 403 for ${url ?? 'an API call'}; the access token is missing the '${required}' scope.`,
      };
    }
    return { kind: 'forbidden', url, message };
  }

  return { kind: 'http', status, url, message };
}

function detectMissingScope(err: RequestErrorLike): string | null {
  const accepted = err.response?.headers?.['x-accepted-oauth-scopes'];
  const present = err.response?.headers?.['x-oauth-scopes'];
  if (!accepted) return null;
  const acceptedScopes = accepted
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (acceptedScopes.length === 0) return null;
  const presentScopes = new Set(
    (present ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
  );
  // x-accepted-oauth-scopes is OR semantics: any one of the listed scopes
  // grants access. If the token has any of them, this 403 isn't a scope
  // problem — GitHub also returns 403 for things like per-repo features
  // being disabled or insufficient repo-level permissions.
  if (acceptedScopes.some((s) => presentScopes.has(s))) return null;
  return acceptedScopes[0] ?? null;
}

export function formatGithubError(err: GithubError): string {
  switch (err.kind) {
    case 'network':
      return `network error talking to GitHub: ${err.message}`;
    case 'not-found':
      return `GitHub returned 404 for ${err.url ?? 'an API call'}`;
    case 'scope-missing':
      return `${err.message}\n  fix: gh auth refresh -s ${err.required}`;
    case 'forbidden':
      return `GitHub returned 403 for ${err.url ?? 'an API call'}: ${err.message}`;
    case 'http':
      return `GitHub returned ${err.status} for ${err.url ?? 'an API call'}: ${err.message}`;
  }
}
