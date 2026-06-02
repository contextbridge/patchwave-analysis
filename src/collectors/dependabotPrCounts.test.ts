import { expect, test } from 'bun:test';
import { buildCountQueries } from './dependabotPrCounts.ts';

test('builds org-scoped queries with archived:false and the window date', () => {
  const q = buildCountQueries('acme', 'org', '2026-03-04T00:00:00Z');
  expect(q.open).toBe('is:pr author:app/dependabot archived:false org:acme is:open');
  expect(q.merged).toBe('is:pr author:app/dependabot archived:false org:acme is:merged merged:>=2026-03-04');
  expect(q.closedUnmerged).toBe(
    'is:pr author:app/dependabot archived:false org:acme is:unmerged is:closed closed:>=2026-03-04',
  );
});

test('uses the user: qualifier for user targets', () => {
  const q = buildCountQueries('blimmer', 'user', '2026-03-04T00:00:00Z');
  expect(q.open).toBe('is:pr author:app/dependabot archived:false user:blimmer is:open');
});
