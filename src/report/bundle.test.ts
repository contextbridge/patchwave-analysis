import { expect, test } from 'bun:test';
import { strFromU8, unzipSync } from 'fflate';
import { collectedData, dependabotPr } from '../testFactories.ts';
import { aggregate } from './aggregate.ts';
import { type BundleMeta, buildBundleFiles, zipBundleFiles } from './bundle.ts';

const meta: BundleMeta = {
  cliVersion: '0.0.1',
  generatedAt: '2026-05-22T00:00:00Z',
  target: 'acme',
  windowDays: 90,
  windowStart: '2026-02-21T00:00:00Z',
  options: { include: null, exclude: [] },
  counts: { reposTotal: 1, reposIncluded: 1, dependabotPrs: 1, warnings: 0 },
};

test('buildBundleFiles emits one JSON file per slice plus the markdown and README', () => {
  const collected = collectedData.build({ dependabotPrs: [dependabotPr.build()] });
  const aggregated = aggregate(collected);
  const files = buildBundleFiles({ meta, collected, aggregated, reportMarkdown: '# report' });

  expect(Object.keys(files).sort()).toEqual(
    [
      'README.txt',
      'data/aggregated.json',
      'data/branch-protection.json',
      'data/contributors.json',
      'data/cve.json',
      'data/dependabot-config.json',
      'data/dependabot-prs.json',
      'data/languages.json',
      'data/meta.json',
      'data/repos.json',
      'data/reverts.json',
      'data/warnings.json',
      'patchwave-report.md',
    ].sort(),
  );
  expect(files['patchwave-report.md']).toBe('# report');
  expect(files['README.txt']).toContain('patchwave-analysis bundle');
});

test('data JSON files are pretty-printed and slice-shaped', () => {
  const collected = collectedData.build({ dependabotPrs: [dependabotPr.build({ number: 42 })] });
  const aggregated = aggregate(collected);
  const files = buildBundleFiles({ meta, collected, aggregated, reportMarkdown: '' });

  const repos = JSON.parse(files['data/repos.json'] as string) as unknown;
  expect(Array.isArray(repos)).toBe(true);

  const prs = JSON.parse(files['data/dependabot-prs.json'] as string) as Array<{ number: number }>;
  expect(prs[0]?.number).toBe(42);

  expect(files['data/aggregated.json']).toContain('  '); // indented
});

test('zipBundleFiles round-trips through unzipSync', () => {
  const zip = zipBundleFiles({ 'patchwave-report.md': '# hi', 'data/meta.json': '{}\n' });
  const entries = unzipSync(zip);
  expect(strFromU8(entries['patchwave-report.md'] as Uint8Array)).toBe('# hi');
  expect(strFromU8(entries['data/meta.json'] as Uint8Array)).toBe('{}\n');
});
