const dayFormat = new Intl.NumberFormat('en-US', { style: 'unit', unit: 'day', unitDisplay: 'narrow' });

export function fmtDaysShort(d: number | null): string {
  if (d === null) return 'n/a';
  return dayFormat.format(d);
}
