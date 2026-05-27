import { ResultAsync } from 'neverthrow';
import type { GithubClient } from '../github/GithubClient.ts';
import type { PromptError, Prompter } from '../prompt/Prompter.ts';

// GitHub login rules: alphanumeric or single hyphens, no leading/trailing hyphen, max 39 chars.
// Same shape applies to both users and orgs.
const GITHUB_LOGIN_PATTERN = /^[A-Za-z0-9](?:[A-Za-z0-9]|-(?=[A-Za-z0-9])){0,38}$/;

const OTHER_VALUE = '__other__';

export interface TargetPromptDeps {
  readonly prompter: Prompter;
  readonly githubClient: GithubClient;
}

interface TargetOption {
  readonly login: string;
  readonly type: 'user' | 'org';
}

export function promptForTarget(deps: TargetPromptDeps): ResultAsync<string, PromptError> {
  const spinner = deps.prompter.spinner();
  spinner.start('Looking up orgs your token can see...');
  return ResultAsync.fromSafePromise(loadOptions(deps.githubClient)).andThen((options) => {
    if (options.length === 0) {
      spinner.stop("Couldn't list your orgs — type one instead.");
      return promptForTargetText(deps.prompter);
    }
    spinner.clear();
    return pickFromOptions(deps.prompter, options);
  });
}

function pickFromOptions(prompter: Prompter, options: readonly TargetOption[]): ResultAsync<string, PromptError> {
  const choices = [
    ...options.map((o) => ({
      value: o.login,
      label: o.login,
      hint: o.type === 'user' ? 'your personal account' : 'organization',
    })),
    { value: OTHER_VALUE, label: 'Other (type a name)', hint: 'analyze any GitHub org or user' },
  ];

  return prompter
    .select<string>({
      message: 'Which GitHub org or user should we analyze?',
      choices,
      initialValue: options[0]?.login,
    })
    .andThen((value) => (value === OTHER_VALUE ? promptForTargetText(prompter) : okString(value)));
}

function promptForTargetText(prompter: Prompter): ResultAsync<string, PromptError> {
  return prompter
    .text({
      message: 'Which GitHub org or user should we analyze?',
      placeholder: 'e.g. vercel',
      validate: (value) => {
        const trimmed = value.trim();
        if (trimmed.length === 0) return 'Please enter a GitHub org or user.';
        if (!GITHUB_LOGIN_PATTERN.test(trimmed)) {
          return "That doesn't look like a GitHub login (letters, numbers, single hyphens; up to 39 chars).";
        }
        return undefined;
      },
    })
    .map((value) => value.trim());
}

function okString(value: string): ResultAsync<string, PromptError> {
  // Tiny helper so the andThen branches above type as the same ResultAsync.
  return ResultAsync.fromSafePromise(Promise.resolve(value));
}

async function loadOptions(client: GithubClient): Promise<TargetOption[]> {
  // Best-effort. Either call can fail (e.g. token lacks read:org); we fall back
  // to free-text input in that case, so individual errors collapse to "no
  // options" rather than killing the prompt.
  const [userResult, orgsResult] = await Promise.all([
    client.request('GET /user'),
    client.paginate('GET /user/orgs', { per_page: 100 }),
  ]);

  const seen = new Set<string>();
  const options: TargetOption[] = [];
  if (userResult.isOk()) {
    options.push({ login: userResult.value.login, type: 'user' });
    seen.add(userResult.value.login);
  }
  if (orgsResult.isOk()) {
    for (const org of orgsResult.value) {
      if (seen.has(org.login)) continue;
      options.push({ login: org.login, type: 'org' });
      seen.add(org.login);
    }
  }
  return options;
}
