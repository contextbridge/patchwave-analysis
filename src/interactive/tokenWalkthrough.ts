import { ResultAsync, errAsync } from 'neverthrow';
import { type AuthError, formatAuthError, resolveToken } from '../github/auth.ts';
import { type PromptError, type Prompter, formatPromptError } from '../prompt/Prompter.ts';

const MAX_ATTEMPTS = 3;

export interface InteractiveTokenDeps {
  readonly prompter: Prompter;
  /** Returns the path to `gh` if installed, null otherwise. Defaults to `Bun.which('gh')`. */
  readonly hasGhCli?: () => boolean;
  /** Token resolver; defaults to the real one. Override in tests. */
  readonly resolve?: () => ResultAsync<string, AuthError>;
}

export type InteractiveTokenError =
  | { kind: 'gave-up'; lastError: AuthError }
  | { kind: 'cancelled' }
  | { kind: 'prompt-failed'; message: string };

export function interactiveResolveToken(deps: InteractiveTokenDeps): ResultAsync<string, InteractiveTokenError> {
  const resolve = deps.resolve ?? resolveToken;
  const hasGh = deps.hasGhCli ?? defaultHasGhCli;
  return attempt(deps.prompter, resolve, hasGh, 0);
}

function attempt(
  prompter: Prompter,
  resolve: () => ResultAsync<string, AuthError>,
  hasGh: () => boolean,
  attemptIndex: number,
): ResultAsync<string, InteractiveTokenError> {
  return resolve()
    .map((token) => {
      if (attemptIndex > 0) prompter.info('GitHub token detected. Continuing...');
      return token;
    })
    .orElse((authErr) => {
      if (attemptIndex >= MAX_ATTEMPTS) {
        prompter.error(`Still no token after ${MAX_ATTEMPTS} attempts. Last error: ${formatAuthError(authErr)}`);
        return errAsync<string, InteractiveTokenError>({ kind: 'gave-up', lastError: authErr });
      }
      const instructions = hasGh() ? ghInstructions() : patInstructions();
      prompter.note(instructions, attemptIndex === 0 ? 'GitHub token required' : 'Try again');
      return prompter
        .confirm({
          message: "Press Enter once you're signed in (or N to abort).",
          defaultValue: true,
        })
        .mapErr(toInteractiveTokenError)
        .andThen((ready) =>
          ready
            ? attempt(prompter, resolve, hasGh, attemptIndex + 1)
            : errAsync<string, InteractiveTokenError>({ kind: 'cancelled' }),
        );
    });
}

function defaultHasGhCli(): boolean {
  return Bun.which('gh') !== null;
}

function ghInstructions(): string {
  return [
    "We need a GitHub token to read your org's Dependabot data.",
    '',
    'I see the gh CLI installed. In another terminal, run:',
    '',
    '    gh auth login --scopes "repo,read:org,security_events"',
    '',
    'Pick GitHub.com → HTTPS → "Login with a web browser" and follow the prompts.',
  ].join('\n');
}

function patInstructions(): string {
  return [
    "We need a GitHub token to read your org's Dependabot data.",
    '',
    '1. Open https://github.com/settings/tokens/new',
    "   (You'll be asked to confirm your password.)",
    '',
    '2. In "Note", enter something memorable, e.g.  patchwave-analysis',
    '',
    '3. In "Expiration", pick whatever you\'re comfortable with',
    '   (30 days is the default and is fine — you can revoke it any time).',
    '',
    '4. Under "Select scopes", tick these top-level boxes:',
    '',
    '     [x] repo          ← grants full repo access; this also auto-ticks',
    '                         security_events for CVE data',
    '     [x] read:org      ← it sits under admin:org; tick read:org only',
    '',
    '   You can leave every other box unchecked.',
    '',
    '5. Scroll to the bottom and click the green "Generate token" button.',
    '',
    '6. GitHub will show the token exactly once (it starts with "ghp_").',
    '   Copy it, then in this terminal run:',
    '',
    '       export GITHUB_TOKEN=ghp_...',
  ].join('\n');
}

function toInteractiveTokenError(err: PromptError): InteractiveTokenError {
  return err.kind === 'cancelled' ? { kind: 'cancelled' } : { kind: 'prompt-failed', message: formatPromptError(err) };
}

export function formatInteractiveTokenError(err: InteractiveTokenError): string {
  switch (err.kind) {
    case 'cancelled':
      return 'token setup cancelled';
    case 'gave-up':
      return `gave up after ${MAX_ATTEMPTS} attempts: ${formatAuthError(err.lastError)}`;
    case 'prompt-failed':
      return err.message;
  }
}
