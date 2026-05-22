import { expect, test } from 'bun:test';
import { dependabotPr } from '../testFactories.ts';
import { extractPackageNameFromHeadRef, findSiblingBumps } from './siblingBump.ts';

test('extracts package name from canonical head ref', () => {
  expect(extractPackageNameFromHeadRef('dependabot/npm_and_yarn/lodash-4.17.21')).toBe('lodash');
});

test('extracts package name from scoped package head ref', () => {
  expect(extractPackageNameFromHeadRef('dependabot/npm_and_yarn/types/node-18.0.1')).toBe('node');
});

test('returns null for non-dependabot refs', () => {
  expect(extractPackageNameFromHeadRef('feat/something')).toBeNull();
});

test('groups multiple open PRs targeting the same dependency in one repo', () => {
  const prs = [
    dependabotPr.build({ number: 1, headRef: 'dependabot/npm_and_yarn/lodash-4.17.21' }),
    dependabotPr.build({ number: 2, headRef: 'dependabot/npm_and_yarn/lodash-4.17.22' }),
    dependabotPr.build({ number: 3, headRef: 'dependabot/npm_and_yarn/react-18.3.0' }),
  ];
  const groups = findSiblingBumps(prs);
  expect(groups).toHaveLength(1);
  expect(groups[0]).toMatchObject({ packageName: 'lodash', prNumbers: [1, 2] });
});

test('ignores merged/closed PRs', () => {
  const prs = [
    dependabotPr.build({ number: 1, headRef: 'dependabot/npm_and_yarn/lodash-4.17.21' }),
    dependabotPr.build({
      number: 2,
      headRef: 'dependabot/npm_and_yarn/lodash-4.17.22',
      state: 'closed',
    }),
  ];
  expect(findSiblingBumps(prs)).toHaveLength(0);
});
