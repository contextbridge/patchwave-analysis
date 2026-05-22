import { expect, test } from 'bun:test';
import { renderMarkdown } from './markdown.ts';
import { cveExposureScopeMissing, recommendation, reportBundle } from './testFactories.ts';

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

test('renders empty recommendations gracefully', () => {
  const bundle = reportBundle.build({ recommendations: [] });
  const md = renderMarkdown(bundle);
  expect(md).toContain('No high-leverage recommendations');
});
