export function repoShortName(repo: string): string {
  return repo.slice(repo.lastIndexOf('/') + 1);
}
