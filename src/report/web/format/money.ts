export function fmtUsd(n: number): string {
  return `$${Math.round(n).toLocaleString('en-US')}`;
}
