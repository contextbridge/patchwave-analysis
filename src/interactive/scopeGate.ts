import type { Context } from '../context/index.ts';
import type { GithubError } from '../github/errors.ts';

// PatchWave needs a classic token with `repo` (private repos + PR data) and
// `read:org` (org repo listing). `repo` also covers `security_events` for CVEs.
const REQUIRED_SCOPES = ['repo', 'read:org'] as const;

type ScopeGateResult = { kind: 'ok' } | { kind: 'list-failed'; error: GithubError } | { kind: 'insufficient' };

// Validates the token's scopes before any crawl, prompting the user with a fix
// when they're wrong. A token that can't see private repos (a fine-grained token,
// or a classic one missing `repo`) silently omits them from GraphQL search, which
// would surface as a confident $0 — so we gate up front and let the user fix the
// token first rather than after a misleading crawl.
export async function checkTokenScopes(ctx: Context): Promise<ScopeGateResult> {
  const { githubClient, prompter } = ctx;

  const scopes = await githubClient.getOAuthScopes();
  if (scopes.isErr()) return { kind: 'list-failed', error: scopes.error };

  const problem = scopeProblem(scopes.value);
  if (problem === null) return { kind: 'ok' };

  prompter.error(SCOPE_GATE_WARNING);
  prompter.note(problem === 'fine-grained' ? FINE_GRAINED_FIX : missingScopeFix(problem), 'Fix the token');
  return { kind: 'insufficient' };
}

// `null` => fine, `'fine-grained'` => no classic scopes header at all, otherwise
// the required scopes the token is missing.
function scopeProblem(scopes: string[] | null): 'fine-grained' | string[] | null {
  if (scopes === null) return 'fine-grained';
  const have = new Set(scopes);
  const missing = REQUIRED_SCOPES.filter((s) => !have.has(s));
  return missing.length > 0 ? missing : null;
}

function missingScopeFix(missing: string[]): string {
  return [
    `The token is missing the ${missing.map((s) => `\`${s}\``).join(' and ')} scope${missing.length > 1 ? 's' : ''}.`,
    '',
    'Grant a classic token both of these, then run patchwave-analysis again:',
    '',
    '  • repo       private repos and pull-request data (also covers security_events)',
    "  • read:org   listing the org's repos",
  ].join('\n');
}

const SCOPE_GATE_WARNING =
  "This token can't read everything PatchWave needs, so the report would undercount. Fix it, then run patchwave-analysis again.";

const FINE_GRAINED_FIX = [
  'PatchWave needs a classic token; fine-grained tokens are not supported due to GitHub API restrictions.',
  '',
  'Create one at https://github.com/settings/tokens/new with these scopes:',
  '',
  '  • repo       private repos and pull-request data (also covers security_events)',
  "  • read:org   listing the org's repos",
  '',
  'Then export GITHUB_TOKEN and run patchwave-analysis again.',
].join('\n');
