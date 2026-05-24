import { expect, test } from 'bun:test';
import { classifyBumpType, isDevDependencyBump } from './bumpType.ts';

test('classifies a patch bump', () => {
  expect(classifyBumpType('Bump lodash from 4.17.20 to 4.17.21')).toBe('patch');
});

test('classifies a minor bump', () => {
  expect(classifyBumpType('Bump lodash from 4.17.20 to 4.18.0')).toBe('minor');
});

test('classifies a major bump', () => {
  expect(classifyBumpType('Bump lodash from 4.17.20 to 5.0.0')).toBe('major');
});

test('handles conventional commit prefix', () => {
  expect(classifyBumpType('build(deps): bump react from 18.2.0 to 18.3.0')).toBe('minor');
});

test('handles dev-deps conventional commit prefix', () => {
  expect(classifyBumpType('build(deps-dev): bump @types/node from 18.0.0 to 18.0.1')).toBe('patch');
});

test('returns other for unparseable titles', () => {
  expect(classifyBumpType('Update some dependency')).toBe('other');
});

test('classifies grouped Dependabot updates as grouped', () => {
  expect(classifyBumpType('Bump the production-dependencies group with 5 updates')).toBe('grouped');
  expect(classifyBumpType('Bump the github-actions group across 3 directories with 6 updates')).toBe('grouped');
  expect(classifyBumpType('build(deps): bump the prod-deps group with 4 updates')).toBe('grouped');
});

test('detects dev-dependency bumps via conventional commit', () => {
  expect(isDevDependencyBump('build(deps-dev): bump @types/node from 18.0.0 to 18.0.1')).toBe(true);
  expect(isDevDependencyBump('build(deps): bump react from 18.0.0 to 18.0.1')).toBe(false);
  expect(isDevDependencyBump('Bump react from 18.0.0 to 18.0.1')).toBe(false);
});
