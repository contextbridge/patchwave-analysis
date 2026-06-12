import { type ResultAsync, okAsync } from 'neverthrow';
import type { PromptError, Prompter } from '../context/Prompter.ts';
import type { RepoMeta, RepositorySelection } from '../types.ts';
import { allActiveRepositorySelection, isActiveRepo, repoKey } from '../types.ts';

type SelectionMode = 'all' | 'chooseFromAll' | 'chooseFromNone';

interface RepositorySelectionPromptDeps {
  readonly prompter: Prompter;
  readonly repos: readonly RepoMeta[];
}

export function promptForRepositorySelection(
  deps: RepositorySelectionPromptDeps,
): ResultAsync<RepositorySelection, PromptError> {
  const { prompter, repos } = deps;
  const activeRepos = repos.filter(isActiveRepo).sort((a, b) => repoKey(a).localeCompare(repoKey(b)));

  if (activeRepos.length === 0) {
    prompter.warn('No active repositories found for this target.');
    return okAsync(allActiveRepositorySelection(repos));
  }

  if (activeRepos.length === 1) {
    return okAsync(allActiveRepositorySelection(repos));
  }

  return prompter
    .select<SelectionMode>({
      message: `This target has ${activeRepos.length} active repositories. Analyze all of them?`,
      choices: [
        { value: 'all', label: `All ${activeRepos.length} active repositories` },
        { value: 'chooseFromAll', label: 'Choose repositories — start with all selected' },
        { value: 'chooseFromNone', label: 'Choose repositories — start with none selected' },
      ],
      initialValue: 'all',
    })
    .andThen((mode): ResultAsync<RepositorySelection, PromptError> => {
      if (mode === 'all') return okAsync(allActiveRepositorySelection(repos));

      const allKeys = activeRepos.map(repoKey);
      const choices = activeRepos.map((r) => ({
        value: repoKey(r),
        label: repoKey(r),
        hint: [r.visibility, r.primaryLanguage].filter(Boolean).join(' · '),
      }));
      const initialValues = mode === 'chooseFromAll' ? allKeys : [];

      return prompter
        .multiSelect<string>({
          message: 'Select repositories to analyze',
          choices,
          initialValues,
          required: true,
          placeholder: 'Search repositories...',
        })
        .map((selected): RepositorySelection => {
          const sorted = [...selected].sort();
          const normalizedMode = sorted.length === activeRepos.length ? 'all' : 'selected';
          return {
            mode: normalizedMode,
            selectedRepoKeys: sorted,
            availableActiveRepoCount: activeRepos.length,
          };
        });
    });
}
