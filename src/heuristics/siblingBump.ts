import type { DependabotPr } from "../types.ts";

export interface SiblingGroup {
  repo: string;
  packageName: string;
  prNumbers: number[];
}

const HEAD_REF_RE = /^dependabot\/[\w-]+\/(?:.+\/)?([^/]+?)-\d[\d.\w+-]*$/;

export function extractPackageNameFromHeadRef(headRef: string): string | null {
  const match = HEAD_REF_RE.exec(headRef);
  return match?.[1] ?? null;
}

export function findSiblingBumps(prs: readonly DependabotPr[]): SiblingGroup[] {
  const open = prs.filter((p) => p.state === "open");
  const buckets = new Map<string, { repo: string; packageName: string; numbers: number[] }>();
  for (const pr of open) {
    const pkg = extractPackageNameFromHeadRef(pr.headRef);
    if (!pkg) continue;
    const key = `${pr.owner}/${pr.name}::${pkg}`;
    const repo = `${pr.owner}/${pr.name}`;
    let bucket = buckets.get(key);
    if (!bucket) {
      bucket = { repo, packageName: pkg, numbers: [] };
      buckets.set(key, bucket);
    }
    bucket.numbers.push(pr.number);
  }
  return [...buckets.values()]
    .filter((b) => b.numbers.length >= 2)
    .map((b) => ({ repo: b.repo, packageName: b.packageName, prNumbers: b.numbers.sort((a, c) => a - c) }))
    .sort((a, b) => b.prNumbers.length - a.prNumbers.length);
}
