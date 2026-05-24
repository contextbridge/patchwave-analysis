import { expect, test } from 'bun:test';
import { welcomeBannerBody, welcomeBannerTitle } from './banner.ts';

test('title names the tool', () => {
  expect(welcomeBannerTitle()).toBe('patchwave-analysis');
});

test('body explains the executive summary, points at PatchWave, and is honest about egress', () => {
  const body = welcomeBannerBody();
  expect(body).toContain('Dependabot');
  expect(body).toContain('executive summary');
  expect(body).toContain('PatchWave');
  expect(body).toContain('patchwave.ai');
  expect(body).toContain('GitHub');
  expect(body).toContain('choose whether to send us');
});
