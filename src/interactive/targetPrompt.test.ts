import { describe, expect, test } from 'bun:test';
import { FakeGithubClient, FakePrompter } from '../testHelpers/index.ts';
import { promptForTarget } from './targetPrompt.ts';
import { githubOrg, githubViewer } from './testFactories.ts';

function stubViewer(githubClient: FakeGithubClient, login: string): void {
  githubClient.onRequest('GET /user').resolves(githubViewer.build({ login }));
}

function stubOrgs(githubClient: FakeGithubClient, logins: string[]): void {
  githubClient.onPaginate('GET /user/orgs').resolves(logins.map((login) => githubOrg.build({ login })));
}

describe('promptForTarget', () => {
  test('shows viewer + orgs + "Other" in the select and returns the picked value', async () => {
    const prompter = new FakePrompter().scriptSelect('acme');
    const githubClient = new FakeGithubClient();
    stubViewer(githubClient, 'ben');
    stubOrgs(githubClient, ['acme', 'widgets-co']);

    const result = await promptForTarget({ prompter, githubClient });

    expect(result.isOk()).toBe(true);
    expect(result.unwrapOr('')).toBe('acme');
    const choices = prompter.selects[0]?.choices ?? [];
    expect(choices.map((c) => c.value)).toEqual(['ben', 'acme', 'widgets-co', '__other__']);
    expect(choices[0]?.hint).toContain('personal');
    expect(choices[1]?.hint).toContain('organization');
    expect(choices.at(-1)?.label).toContain('Other');
  });

  test('"Other" routes to a free-text prompt with login validation', async () => {
    const prompter = new FakePrompter().scriptSelect('__other__').scriptText('  vercel  ');
    const githubClient = new FakeGithubClient();
    stubViewer(githubClient, 'ben');
    stubOrgs(githubClient, ['acme']);

    const result = await promptForTarget({ prompter, githubClient });

    expect(result.isOk()).toBe(true);
    expect(result.unwrapOr('')).toBe('vercel');
    expect(prompter.texts[0]?.message).toContain('GitHub org or user');
  });

  test('deduplicates if the viewer login appears in their orgs list', async () => {
    const prompter = new FakePrompter().scriptSelect('ben');
    const githubClient = new FakeGithubClient();
    stubViewer(githubClient, 'ben');
    stubOrgs(githubClient, ['ben', 'acme']);

    await promptForTarget({ prompter, githubClient });

    const values = (prompter.selects[0]?.choices ?? []).map((c) => c.value);
    expect(values.filter((v) => v === 'ben')).toHaveLength(1);
  });

  test('falls back to free-text input when GitHub returns no options', async () => {
    const prompter = new FakePrompter().scriptText('vercel');
    const githubClient = new FakeGithubClient();
    githubClient.onRequest('GET /user').fails({ kind: 'http', status: 401, message: 'bad token' });
    githubClient.onPaginate('GET /user/orgs').fails({ kind: 'forbidden', message: 'no read:org' });

    const result = await promptForTarget({ prompter, githubClient });

    expect(result.isOk()).toBe(true);
    expect(result.unwrapOr('')).toBe('vercel');
    expect(prompter.selects).toHaveLength(0);
    expect(prompter.texts).toHaveLength(1);
  });

  test('cancellation in the select propagates', async () => {
    const prompter = new FakePrompter().scriptSelect({ kind: 'cancelled' });
    const githubClient = new FakeGithubClient();
    stubViewer(githubClient, 'ben');
    stubOrgs(githubClient, ['acme']);

    const result = await promptForTarget({ prompter, githubClient });

    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr()).toEqual({ kind: 'cancelled' });
  });

  test('text-fallback validation: rejects empty + invalid logins, accepts valid ones', async () => {
    const prompter = new FakePrompter().scriptText('vercel');
    const githubClient = new FakeGithubClient();
    githubClient.onRequest('GET /user').fails({ kind: 'http', status: 401, message: 'bad token' });
    githubClient.onPaginate('GET /user/orgs').fails({ kind: 'forbidden', message: 'no read:org' });

    await promptForTarget({ prompter, githubClient });
    const validate = prompter.texts[0]?.validate;
    expect(validate?.('')).toContain('enter');
    expect(validate?.('-leading-hyphen')).toBeDefined();
    expect(validate?.('has spaces')).toBeDefined();
    expect(validate?.('vercel')).toBeUndefined();
    expect(validate?.('acme-corp')).toBeUndefined();
  });
});
