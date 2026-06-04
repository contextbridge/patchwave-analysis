import type { Instant } from './time.ts';

const MS_PER_DAY = 86_400_000;

// UTC calendar day for GitHub search date qualifiers (`created:`/`closed:`), derived
// from the instant rather than the polyfill's PlainDate (whose ambient-vs-class typings
// conflict).
export function dateStr(i: Instant): string {
  return i.toString().slice(0, 10);
}

// Whole-day index used for bisection arithmetic, so date math works on integers.
export function epochDay(i: Instant): number {
  return Math.floor(Number(i.epochMilliseconds) / MS_PER_DAY);
}

export function addDays(i: Instant, days: number): Instant {
  return i.add({ hours: days * 24 });
}

export function midpoint(start: Instant, end: Instant): Instant {
  return addDays(start, Math.floor((epochDay(end) - epochDay(start)) / 2));
}
