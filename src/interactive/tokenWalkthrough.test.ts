import { describe, expect, test } from 'bun:test';
import { errAsync, okAsync } from 'neverthrow';
import type { AuthError } from '../github/auth.ts';
import { FakePrompter } from '../testHelpers/index.ts';
import { noTokenAuthError } from './testFactories.ts';
import { interactiveResolveToken } from './tokenWalkthrough.ts';

function noToken(message = 'no token'): AuthError {
  return noTokenAuthError.build({ message });
}

describe('interactiveResolveToken', () => {
  test('returns the token immediately when resolve succeeds on first try', async () => {
    const prompter = new FakePrompter();
    const result = await interactiveResolveToken({
      prompter,
      hasGhCli: () => true,
      resolve: () => okAsync('ghp_token'),
    });

    expect(result.isOk()).toBe(true);
    expect(result.unwrapOr('')).toBe('ghp_token');
    expect(prompter.notes).toHaveLength(0);
    expect(prompter.confirms).toHaveLength(0);
  });

  test('shows gh-cli instructions when gh is on PATH, retries after user presses Enter', async () => {
    const prompter = new FakePrompter().scriptConfirm(true);
    let calls = 0;
    const result = await interactiveResolveToken({
      prompter,
      hasGhCli: () => true,
      resolve: () => {
        calls += 1;
        return calls === 1 ? errAsync(noToken()) : okAsync('ghp_token');
      },
    });

    expect(result.isOk()).toBe(true);
    expect(calls).toBe(2);
    const note = prompter.notes[0];
    expect(note?.title).toBe('GitHub token required');
    expect(note?.message).toContain('gh auth login --scopes');
    expect(note?.message).toContain('repo,read:org,security_events');
    expect(note?.message).not.toContain('github.com/settings/tokens');
    // also offers the read-only fine-grained alternative
    expect(note?.message).toContain('fine-grained');
    expect(note?.message).toContain('Dependabot alerts');
  });

  test('shows PAT instructions matching the GitHub UI when gh is not installed', async () => {
    const prompter = new FakePrompter().scriptConfirm(true);
    let calls = 0;
    const result = await interactiveResolveToken({
      prompter,
      hasGhCli: () => false,
      resolve: () => {
        calls += 1;
        return calls === 1 ? errAsync(noToken()) : okAsync('ghp_token');
      },
    });

    expect(result.isOk()).toBe(true);
    const note = prompter.notes[0];
    expect(note?.message).toContain('https://github.com/settings/tokens/new');
    expect(note?.message).toContain('[x] repo');
    expect(note?.message).toContain('[x] read:org');
    expect(note?.message).toContain('Generate token');
    expect(note?.message).toContain('export GITHUB_TOKEN=ghp_');
    // also offers the read-only fine-grained alternative
    expect(note?.message).toContain('settings/personal-access-tokens/new');
    expect(note?.message).toContain('Dependabot alerts');
  });

  test('user declines the retry prompt: returns cancelled', async () => {
    const prompter = new FakePrompter().scriptConfirm(false);
    const result = await interactiveResolveToken({
      prompter,
      hasGhCli: () => true,
      resolve: () => errAsync(noToken()),
    });

    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr()).toEqual({ kind: 'cancelled' });
  });

  test('gives up after 3 unsuccessful retries', async () => {
    const prompter = new FakePrompter().scriptConfirm(true).scriptConfirm(true).scriptConfirm(true);
    let calls = 0;
    const result = await interactiveResolveToken({
      prompter,
      hasGhCli: () => true,
      resolve: () => {
        calls += 1;
        return errAsync(noToken(`fail ${calls}`));
      },
    });

    expect(result.isErr()).toBe(true);
    expect(calls).toBe(4); // initial + 3 retries
    const err = result._unsafeUnwrapErr();
    expect(err.kind).toBe('gave-up');
  });
});
