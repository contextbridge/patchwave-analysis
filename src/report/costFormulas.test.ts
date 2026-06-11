import { expect, test } from 'bun:test';
import { deriveHoursEstimate, derivePersonHours } from './costFormulas.ts';

test('deriveHoursEstimate derives window, monthly, and annual hours from raw counts', () => {
  const hours = deriveHoursEstimate(162, 90, 12);
  expect(hours.windowHours).toBeCloseTo(32.4, 5);
  expect(hours.monthlyHours).toBeCloseTo(10.95, 2);
  expect(hours.annualHours).toBeCloseTo(131.4, 5);
});

test('derivePersonHours derives window and annual hours for one person', () => {
  const hours = derivePersonHours(10, 90, 12);
  expect(hours.windowHours).toBeCloseTo(2, 5);
  expect(hours.annualHours).toBeCloseTo(8.11, 2);
});

test('zero count yields all zeros', () => {
  expect(deriveHoursEstimate(0, 90, 12)).toEqual({ windowHours: 0, monthlyHours: 0, annualHours: 0 });
  expect(derivePersonHours(0, 90, 12)).toEqual({ windowHours: 0, annualHours: 0 });
});

test('a zero window does not divide by zero (clamped to one day)', () => {
  const hours = deriveHoursEstimate(162, 0, 12);
  expect(Number.isFinite(hours.monthlyHours)).toBe(true);
  expect(Number.isFinite(hours.annualHours)).toBe(true);
  expect(hours.annualHours).toBeCloseTo(32.4 * 365, 1);
});
