import type { RepositorySelection } from '../../../types.ts';

export function scopeLabel(scope: RepositorySelection): string {
  return scope.mode === 'selected' ? `${scope.selectedRepoKeys.length} of ${scope.availableActiveRepoCount} repos` : '';
}

export function reposScannedLabel(scope: RepositorySelection, activeRepoCount: number): string {
  return scope.mode === 'selected'
    ? `${scope.selectedRepoKeys.length} of ${scope.availableActiveRepoCount} active selected`
    : `${activeRepoCount} active`;
}
