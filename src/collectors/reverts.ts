import type { ResultAsync } from 'neverthrow';
import type { GithubError } from '../github/errors.ts';
import type { GithubClient } from '../github/GithubClient.ts';
import type { DependabotPr, RepoRef, RevertEvent } from '../types.ts';

interface ListCommitsItem {
  sha: string;
  commit: { message: string; committer: { date: string } | null };
}

const REVERT_PR_RE = /Revert\s+["“]?.*?#(\d+)/i;

export function listReverts(
  client: GithubClient,
  ref: RepoRef,
  windowStartIso: string,
  dependabotPrNumbersForRepo: ReadonlySet<number>,
): ResultAsync<RevertEvent[], GithubError> {
  return client
    .paginate<ListCommitsItem>('GET /repos/{owner}/{repo}/commits', {
      owner: ref.owner,
      repo: ref.name,
      since: windowStartIso,
      per_page: 100,
    })
    .map((commits) => {
      const reverts: RevertEvent[] = [];
      for (const c of commits) {
        if (!c.commit.message.startsWith('Revert ')) continue;
        const revertedPr = extractRevertedPrNumber(c.commit.message);
        reverts.push({
          owner: ref.owner,
          name: ref.name,
          sha: c.sha,
          message: firstLine(c.commit.message),
          committedAt: c.commit.committer?.date ?? '',
          revertedPrNumber: revertedPr,
          revertsDependabotPr: revertedPr !== null && dependabotPrNumbersForRepo.has(revertedPr),
        });
      }
      return reverts;
    });
}

export function indexDependabotPrsByRepo(prs: readonly DependabotPr[]): Map<string, Set<number>> {
  const index = new Map<string, Set<number>>();
  for (const pr of prs) {
    const key = `${pr.owner}/${pr.name}`;
    let set = index.get(key);
    if (!set) {
      set = new Set();
      index.set(key, set);
    }
    set.add(pr.number);
  }
  return index;
}

function extractRevertedPrNumber(message: string): number | null {
  const match = REVERT_PR_RE.exec(message);
  if (!match || !match[1]) return null;
  const n = Number.parseInt(match[1], 10);
  return Number.isFinite(n) ? n : null;
}

function firstLine(text: string): string {
  const idx = text.indexOf('\n');
  return idx === -1 ? text : text.slice(0, idx);
}
