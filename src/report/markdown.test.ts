import { expect, test } from 'bun:test';
import { renderMarkdown } from './markdown.ts';
import { cveExposureScopeMissing, dependabotCoverage, recommendation, reportBundle } from './testFactories.ts';

test('renders headline numbers in the executive snapshot', () => {
  const md = renderMarkdown(reportBundle.build());
  expect(md).toContain('# Dependabot diagnostic — `acme`');
  expect(md).toContain('273');
  expect(md).toContain('102');
  expect(md).toContain('engineer-hours/week');
});

test('renders the scope-missing CVE section when scope is absent', () => {
  const bundle = reportBundle.build({
    cve: cveExposureScopeMissing.build({ requiredScope: 'security_events' }),
  });
  const md = renderMarkdown(bundle);
  expect(md).toContain('CVE exposure (scope missing)');
  expect(md).toContain('gh auth refresh -s security_events');
});

test('includes recommendations when any are present', () => {
  const bundle = reportBundle.build({
    recommendations: [
      recommendation.build({
        priority: 'high',
        message: 'Your oldest open Critical CVE is 95 days old.',
      }),
      recommendation.build({
        priority: 'medium',
        message: '10 repos sitting at the PR cap.',
      }),
    ],
  });
  const md = renderMarkdown(bundle);
  expect(md).toContain('High priority');
  expect(md).toContain('Medium priority');
  expect(md).toContain('95 days old');
});

test('renders the schedule cadence table and groups/ignore line', () => {
  const bundle = reportBundle.build({
    dependabotCoverage: dependabotCoverage.build({
      cadenceBreakdown: [
        { interval: 'daily', entryCount: 3 },
        { interval: 'weekly', entryCount: 12 },
      ],
      reposUsingGroups: 4,
      reposWithIgnoreRules: 2,
    }),
  });
  const md = renderMarkdown(bundle);
  expect(md).toContain('### Schedule cadence');
  expect(md).toContain('| daily | 3 |');
  expect(md).toContain('| weekly | 12 |');
  expect(md).toContain('**4** repos use grouped updates · **2** repos have `ignore` rules');
});

test('renders empty recommendations gracefully', () => {
  const bundle = reportBundle.build({ recommendations: [] });
  const md = renderMarkdown(bundle);
  expect(md).toContain('No high-leverage recommendations');
});
