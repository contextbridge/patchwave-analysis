import { expect, test } from 'bun:test';
import { toGithubError } from './errors.ts';
import { requestError } from './testFactories.ts';

test('403 with a present scope that matches an accepted scope is forbidden, not scope-missing', () => {
  // GitHub's x-accepted-oauth-scopes header is OR semantics — any one scope in
  // the list grants access. If the token has any of them, this 403 is not a
  // token problem (it's typically a per-repo feature disabled / permission).
  const err = requestError.build({
    response: {
      headers: {
        'x-accepted-oauth-scopes': 'admin:repo_hook, repo, security_events',
        'x-oauth-scopes': 'gist, read:org, repo',
      },
    },
    message: 'Dependabot alerts are disabled for this repository.',
  });
  expect(toGithubError(err)).toMatchObject({ kind: 'forbidden' });
});

test('403 with no overlapping scopes is scope-missing, reporting the first accepted scope', () => {
  const err = requestError.build({
    response: {
      headers: {
        'x-accepted-oauth-scopes': 'security_events, repo',
        'x-oauth-scopes': 'read:org',
      },
    },
  });
  expect(toGithubError(err)).toMatchObject({ kind: 'scope-missing', required: 'security_events' });
});

test('403 with no x-accepted-oauth-scopes header is forbidden', () => {
  const err = requestError.build({ response: { headers: {} } });
  expect(toGithubError(err)).toMatchObject({ kind: 'forbidden' });
});
