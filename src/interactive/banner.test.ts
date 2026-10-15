import { expect, test } from 'bun:test';
import { welcomeBannerBody, welcomeBannerTitle } from './banner.ts';

test('title names the tool', () => {
  expect(welcomeBannerTitle()).toBe('PatchWave Dependency Checkup');
});

test('body explains the executive summary, says what PatchWave is, and is honest about egress', () => {
  const body = welcomeBannerBody({ telemetryEnabled: true });
  expect(body).toContain('executive summary');
  expect(body).toContain('Dependabot toil and CVE exposure');
  expect(body).toContain('PatchWave (patchwave.ai) is a GitHub app');
  expect(body).toContain('stays on this machine');
  expect(body).toContain('DO_NOT_TRACK=1');
});

test('body omits the telemetry notice when telemetry is off', () => {
  expect(welcomeBannerBody({ telemetryEnabled: false })).not.toContain('usage stats');
});
