import type { Meta, StoryObj } from '@storybook/react-vite';
import { toEmbeddedShape } from '../embeddedShape.ts';
import { cveExposureOk, cveExposureScopeMissing, orgOverview, reportBundle } from '../testFactories.ts';
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
      ],
      reposWithSecurityAlertsDisabled: ['acme/legacy-cron'],
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

export const Default: Story = {
  args: {
    data: sampleReport,
  },
};

export const CveScopeMissing: Story = {
  args: {
    data: { ...sampleReport, cve: cveExposureScopeMissing.build() },
  },
};
