const LOCKFILE_PATTERNS = [
  /lock[-_ ]?file/i,
  /package-lock/i,
  /yarn\.lock/i,
  /pnpm-lock/i,
  /bun\.lockb/i,
  /\binstall\b/i,
  /\bnpm ci\b/i,
];

export function isLikelyMechanicalFailure(checkName: string): boolean {
  return LOCKFILE_PATTERNS.some((re) => re.test(checkName));
}

export function summarizeMechanicalFailures(failedCheckNames: readonly string[]): {
  mechanical: number;
  nonMechanical: number;
  matched: string[];
} {
  const matched: string[] = [];
  let nonMechanical = 0;
  for (const name of failedCheckNames) {
    if (isLikelyMechanicalFailure(name)) matched.push(name);
    else nonMechanical += 1;
  }
  return { mechanical: matched.length, nonMechanical, matched };
}
