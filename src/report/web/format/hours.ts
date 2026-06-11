export function fmtHours(n: number): string {
  const rounded = Math.round(n);
  return `${rounded.toLocaleString('en-US')} ${rounded === 1 ? 'hr' : 'hrs'}`;
}
