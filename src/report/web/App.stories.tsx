import type { Meta, StoryObj } from '@storybook/react-vite';
import { toEmbeddedShape } from '../embeddedShape.ts';
import { cveExposureOk, cveExposureScopeMissing, orgOverview, people, reportBundle } from '../testFactories.ts';
import { App } from './App.tsx';

// A representative report, built from the same fishery factories the tests use.
// Defaults cover most of the page; the overrides here only fill the spots that
// would otherwise render as single-row tables (language mix, top repos by
// severity) so the snapshot exercises the full UI.
const sampleReport = toEmbeddedShape(
  reportBundle.build({
    orgOverview: orgOverview.build({
      topLanguages: [
        { language: 'TypeScript', bytes: 4_200_000, percentage: 58 },
        { language: 'Go', bytes: 1_600_000, percentage: 22 },
        { language: 'Python', bytes: 880_000, percentage: 12 },
        { language: 'Ruby', bytes: 560_000, percentage: 8 },
      ],
    }),
    cve: cveExposureOk.build({
      topReposBySeverity: [
        { repo: 'acme/api', critical: 1, high: 2, medium: 1, low: 0 },
        { repo: 'acme/web', critical: 0, high: 1, medium: 3, low: 2 },
        { repo: 'acme/billing', critical: 0, high: 0, medium: 2, low: 5 },
        { repo: 'acme/worker', critical: 0, high: 0, medium: 2, low: 1 },
        { repo: 'acme/mobile', critical: 0, high: 0, medium: 1, low: 3 },
        { repo: 'acme/legacy-api', critical: 0, high: 0, medium: 1, low: 1 },
        { repo: 'acme/internal-tools', critical: 0, high: 0, medium: 0, low: 4 },
        { repo: 'acme/docs', critical: 0, high: 0, medium: 0, low: 2 },
      ],
      reposWithSecurityAlertsDisabled: ['acme/legacy-cron'],
    }),
    people: people.build({
      mergers: [
        { login: 'alex', count: 96, windowCostUsd: 1200, annualCostUsd: 4867 },
        { login: 'blair', count: 82, windowCostUsd: 1025, annualCostUsd: 4157 },
        { login: 'casey', count: 70, windowCostUsd: 875, annualCostUsd: 3549 },
        { login: 'devon', count: 64, windowCostUsd: 800, annualCostUsd: 3244 },
        { login: 'ellis', count: 58, windowCostUsd: 725, annualCostUsd: 2940 },
        { login: 'finley', count: 44, windowCostUsd: 550, annualCostUsd: 2231 },
        { login: 'gray', count: 36, windowCostUsd: 450, annualCostUsd: 1825 },
        { login: 'harper', count: 28, windowCostUsd: 350, annualCostUsd: 1420 },
        { login: 'indigo', count: 20, windowCostUsd: 250, annualCostUsd: 1014 },
        { login: 'jules', count: 12, windowCostUsd: 150, annualCostUsd: 608 },
      ],
      reviewers: [
        { login: 'alex', count: 24, windowCostUsd: 180, annualCostUsd: 730 },
        { login: 'casey', count: 18, windowCostUsd: 135, annualCostUsd: 548 },
        { login: 'harper', count: 14, windowCostUsd: 105, annualCostUsd: 426 },
      ],
    }),
  }),
);

const meta = {
  title: 'Report/App',
  component: App,
  parameters: {
    layout: 'fullscreen',
  },
} satisfies Meta<typeof App>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Light: Story = {
  args: {
    data: sampleReport,
  },
  parameters: {
    theme: 'light',
  },
};

export const Dark: Story = {
  args: {
    data: sampleReport,
  },
  parameters: {
    theme: 'dark',
  },
};

export const CveScopeMissing: Story = {
  args: {
    data: { ...sampleReport, cve: cveExposureScopeMissing.build() },
  },
};
