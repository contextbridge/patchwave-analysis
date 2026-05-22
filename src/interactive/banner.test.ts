import { expect, test } from 'bun:test';
import { welcomeBannerBody, welcomeBannerTitle } from './banner.ts';

test('title names the tool', () => {
  expect(welcomeBannerTitle()).toBe('patchwave-analysis');
});

test('body explains the executive summary and the no-egress posture', () => {
  const body = welcomeBannerBody();
  expect(body).toContain('Dependabot');
  expect(body).toContain('executive summary');
  expect(body).toContain('api.github.com');
  expect(body).toContain('share');
});
