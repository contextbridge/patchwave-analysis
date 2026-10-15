import { expect, test } from 'bun:test';
import { PATCHWAVE_URL, withUtm } from './urls.ts';

test('tags a link with the source and medium', () => {
  expect(withUtm(PATCHWAVE_URL, { medium: 'cli' })).toBe(
    'https://patchwave.ai/?utm_source=patchwave-analysis&utm_medium=cli',
  );
});

test('adds content and keeps the fragment after the query', () => {
  expect(withUtm(`${PATCHWAVE_URL}#how-it-works`, { medium: 'report', content: 'how-it-works' })).toBe(
    'https://patchwave.ai/?utm_source=patchwave-analysis&utm_medium=report&utm_content=how-it-works#how-it-works',
  );
});
