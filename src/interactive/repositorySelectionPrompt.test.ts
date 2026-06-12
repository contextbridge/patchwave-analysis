import { describe, expect, it } from 'bun:test';
import { repoMeta } from '../testFactories.ts';
import { FakePrompter } from '../testHelpers/FakePrompter.ts';
import type { RepositorySelection } from '../types.ts';
import { promptForRepositorySelection } from './repositorySelectionPrompt.ts';

const EMPTY_SELECTION: RepositorySelection = { mode: 'all', selectedRepoKeys: [], availableActiveRepoCount: 0 };

describe('promptForRepositorySelection', () => {
  it('returns all-active without prompting when there is one active repo', async () => {
    const prompter = new FakePrompter();
    const repos = [repoMeta.build({ name: 'solo' })];

    const result = await promptForRepositorySelection({ prompter, repos });

    expect(result.isOk()).toBe(true);
    const sel = result.unwrapOr(EMPTY_SELECTION);
    expect(sel.mode).toBe('all');
    expect(sel.availableActiveRepoCount).toBe(1);
    expect(sel.selectedRepoKeys).toEqual(['acme/solo']);
    // No prompts were shown.
    expect(prompter.selects).toHaveLength(0);
  });

  it('returns empty all-active and warns when there are zero active repos', async () => {
    const prompter = new FakePrompter();
    const repos = [repoMeta.build({ name: 'archived', archived: true })];

    const result = await promptForRepositorySelection({ prompter, repos });

    expect(result.isOk()).toBe(true);
    const sel = result.unwrapOr(EMPTY_SELECTION);
    expect(sel.mode).toBe('all');
    expect(sel.availableActiveRepoCount).toBe(0);
    expect(sel.selectedRepoKeys).toEqual([]);
    expect(prompter.warns[0]).toContain('No active repositories');
  });

  it('shows all/start-from-all/start-from-none options and defaults to all', async () => {
    const prompter = new FakePrompter();
    const repos = [repoMeta.build({ name: 'a' }), repoMeta.build({ name: 'b' })];
    prompter.scriptSelect('all');

    const result = await promptForRepositorySelection({ prompter, repos });

    expect(result.isOk()).toBe(true);
    const sel = result.unwrapOr(EMPTY_SELECTION);
    expect(sel.mode).toBe('all');
    expect(sel.availableActiveRepoCount).toBe(2);
    expect(prompter.selects[0]?.choices.map((c) => c.value)).toEqual(['all', 'chooseFromAll', 'chooseFromNone']);
  });

  it('returns a selected subset via multi-select', async () => {
    const prompter = new FakePrompter();
    const repos = [repoMeta.build({ name: 'a' }), repoMeta.build({ name: 'b' }), repoMeta.build({ name: 'c' })];
    prompter.scriptSelect('chooseFromAll');
    prompter.scriptMultiSelect(['acme/a', 'acme/c']);

    const result = await promptForRepositorySelection({ prompter, repos });

    expect(result.isOk()).toBe(true);
    const sel = result.unwrapOr(EMPTY_SELECTION);
    expect(sel.mode).toBe('selected');
    // Keys are sorted.
    expect(sel.selectedRepoKeys).toEqual(['acme/a', 'acme/c']);
    expect(sel.availableActiveRepoCount).toBe(3);
  });

  it('starts the multi-select with all active repos selected when requested', async () => {
    const prompter = new FakePrompter();
    const repos = [repoMeta.build({ name: 'a' }), repoMeta.build({ name: 'b' })];
    prompter.scriptSelect('chooseFromAll');
    prompter.scriptMultiSelect(['acme/a']);

    await promptForRepositorySelection({ prompter, repos });

    expect(prompter.multiSelects[0]?.initialValues).toEqual(['acme/a', 'acme/b']);
  });

  it('starts the multi-select with no repos selected when requested', async () => {
    const prompter = new FakePrompter();
    const repos = [repoMeta.build({ name: 'a' }), repoMeta.build({ name: 'b' })];
    prompter.scriptSelect('chooseFromNone');
    prompter.scriptMultiSelect(['acme/b']);

    const result = await promptForRepositorySelection({ prompter, repos });

    expect(result.isOk()).toBe(true);
    const sel = result.unwrapOr(EMPTY_SELECTION);
    expect(sel).toMatchObject({
      mode: 'selected',
      selectedRepoKeys: ['acme/b'],
      availableActiveRepoCount: 2,
    });
    expect(prompter.multiSelects[0]?.initialValues).toEqual([]);
  });

  it('normalizes back to all when the user selects every active repo', async () => {
    const prompter = new FakePrompter();
    const repos = [repoMeta.build({ name: 'a' }), repoMeta.build({ name: 'b' })];
    prompter.scriptSelect('chooseFromAll');
    prompter.scriptMultiSelect(['acme/a', 'acme/b']);

    const result = await promptForRepositorySelection({ prompter, repos });

    expect(result.isOk()).toBe(true);
    const sel = result.unwrapOr(EMPTY_SELECTION);
    expect(sel.mode).toBe('all');
  });

  it('excludes archived repos and forks from the selectable set', async () => {
    const prompter = new FakePrompter();
    const repos = [
      repoMeta.build({ name: 'active-a' }),
      repoMeta.build({ name: 'active-b' }),
      repoMeta.build({ name: 'archived', archived: true }),
      repoMeta.build({ name: 'forked', fork: true }),
    ];
    prompter.scriptSelect('chooseFromAll');
    prompter.scriptMultiSelect(['acme/active-a']);

    const result = await promptForRepositorySelection({ prompter, repos });

    expect(result.isOk()).toBe(true);
    const sel = result.unwrapOr(EMPTY_SELECTION);
    expect(sel.mode).toBe('selected');
    expect(sel.selectedRepoKeys).toEqual(['acme/active-a']);
    // Multi-select should only offer the 2 active repos.
    const multiOpts = prompter.multiSelects[0];
    expect(multiOpts?.choices.map((c) => c.value)).toEqual(['acme/active-a', 'acme/active-b']);
  });

  it('returns Err when the user cancels the initial select', async () => {
    const prompter = new FakePrompter();
    const repos = [repoMeta.build({ name: 'a' }), repoMeta.build({ name: 'b' })];
    prompter.scriptSelect({ kind: 'cancelled' });

    const result = await promptForRepositorySelection({ prompter, repos });

    expect(result.isErr()).toBe(true);
  });

  it('returns Err when the user cancels the multi-select', async () => {
    const prompter = new FakePrompter();
    const repos = [repoMeta.build({ name: 'a' }), repoMeta.build({ name: 'b' })];
    prompter.scriptSelect('chooseFromAll');
    prompter.scriptMultiSelect({ kind: 'cancelled' });

    const result = await promptForRepositorySelection({ prompter, repos });

    expect(result.isErr()).toBe(true);
  });

  it('sorts active repos by owner/name before offering them', async () => {
    const prompter = new FakePrompter();
    const repos = [repoMeta.build({ name: 'z' }), repoMeta.build({ name: 'a' })];
    prompter.scriptSelect('chooseFromAll');
    prompter.scriptMultiSelect(['acme/a', 'acme/z']);

    await promptForRepositorySelection({ prompter, repos });

    const multiOpts = prompter.multiSelects[0];
    expect(multiOpts?.choices.map((c) => c.value)).toEqual(['acme/a', 'acme/z']);
  });

  it('includes visibility and language hints in multi-select choices', async () => {
    const prompter = new FakePrompter();
    const repos = [
      repoMeta.build({ name: 'web', visibility: 'public', primaryLanguage: 'TypeScript' }),
      repoMeta.build({ name: 'api', visibility: 'private', primaryLanguage: 'Go' }),
    ];
    prompter.scriptSelect('chooseFromAll');
    prompter.scriptMultiSelect(['acme/web', 'acme/api']);

    await promptForRepositorySelection({ prompter, repos });

    const choices = prompter.multiSelects[0]?.choices ?? [];
    expect(choices.find((c) => c.value === 'acme/web')?.hint).toBe('public · TypeScript');
    expect(choices.find((c) => c.value === 'acme/api')?.hint).toBe('private · Go');
  });
});
