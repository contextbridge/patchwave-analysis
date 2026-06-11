import { expect, test } from 'bun:test';
import { fmtHours } from './hours.ts';

test('rounds to whole hours and pluralizes', () => {
  expect(fmtHours(131.4)).toBe('131 hrs');
  expect(fmtHours(1.2)).toBe('1 hr');
  expect(fmtHours(0)).toBe('0 hrs');
  expect(fmtHours(1234.5)).toBe('1,235 hrs');
});
