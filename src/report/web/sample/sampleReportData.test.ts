import { describe, expect, it } from 'bun:test';
import { buildSampleReport, resolveRepoCount, sampleDefaults } from './sampleReportData.ts';

describe('buildSampleReport', () => {
  it('is deterministic for the same inputs', () => {
    expect(buildSampleReport(sampleDefaults)).toEqual(buildSampleReport(sampleDefaults));
  });

  it('propagates the org name and never leaks the factory default "acme"', () => {
    const report = buildSampleReport({ ...sampleDefaults, orgName: 'Globex Industries' });
    expect(report.meta.org).toBe('Globex Industries');
    expect(JSON.stringify(report)).not.toContain('acme');
    expect(report.people.mergers.every((m) => m.login.startsWith('eng-'))).toBe(true);
  });

  it('seeds the repo count from engineers, and lets repos override it directly', () => {
    const seeded = { ...sampleDefaults, engineers: 30, repos: 0 };
    expect(buildSampleReport(seeded).orgOverview.repoCount).toBe(resolveRepoCount(seeded));
    expect(buildSampleReport({ ...sampleDefaults, engineers: 30, repos: 250 }).orgOverview.repoCount).toBe(250);
  });

  it('lands near the real ~120-repo reference run (~$48k/yr at $200/12min)', () => {
    const report = buildSampleReport({ ...sampleDefaults, repos: 126 });
    expect(report.costEstimate.annualCostUsd).toBeGreaterThan(35_000);
    expect(report.costEstimate.annualCostUsd).toBeLessThan(65_000);
  });

  it('scales cost with repo count and produces near-zero reviews', () => {
    const small = buildSampleReport({ ...sampleDefaults, repos: 50 });
    const large = buildSampleReport({ ...sampleDefaults, repos: 500 });
    expect(large.costEstimate.humanMergeCount).toBeGreaterThan(small.costEstimate.humanMergeCount);
    expect(small.costEstimate.humanReviewCount).toBe(0);
  });

  it('uses the report default assumptions ($200/hr, 12 min) so the page can adjust them live', () => {
    const report = buildSampleReport(sampleDefaults);
    expect(report.costEstimate.hourlyRateUsd).toBe(200);
    expect(report.costEstimate.minutesPerPr).toBe(12);
  });

  it('produces a coherent report whose headline equals the people table', () => {
    const report = buildSampleReport(sampleDefaults);
    expect(report.orgOverview.repoCount).toBeGreaterThan(0);
    expect(report.prBacklog.openCount).toBeGreaterThan(0);
    expect(report.people.mergers.length).toBeGreaterThan(0);
    expect(report.cve.totalOpenAlerts).toBeGreaterThan(0);
    const peopleWindowCost = report.people.mergers.reduce((sum, m) => sum + m.windowCostUsd, 0);
    expect(report.costEstimate.windowCostUsd).toBe(peopleWindowCost);
  });

  it('handles a tiny single-engineer org without throwing', () => {
    const report = buildSampleReport({ ...sampleDefaults, engineers: 1, repos: 0 });
    expect(report.orgOverview.repoCount).toBeGreaterThan(0);
    expect(report.costEstimate.annualCostUsd).toBeGreaterThan(0);
  });
});
