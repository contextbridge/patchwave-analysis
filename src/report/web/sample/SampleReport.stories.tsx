import type { Meta, StoryObj } from '@storybook/react-vite';
import { App } from '../App.tsx';
import { type SampleInputs, buildSampleReport, sampleDefaults } from './sampleReportData.ts';

// A self-contained sample report for sales/discovery calls — no GitHub scan required.
// Type the prospect's org name and size and the report re-renders with synthetic-but-
// defensible numbers (calibrated so a ~120-repo org lands near ~$48k/yr). `repos` is the
// real cost driver; `engineers` just seeds a default repo count, and `repos` > 0 overrides
// it. Minutes/PR and $/hr aren't story knobs — adjust them via the report's own "Adjust"
// affordance once it's rendered.

const meta: Meta<SampleInputs> = {
  title: 'Report/Sample',
  parameters: { layout: 'fullscreen' },
  render: (args) => <App data={buildSampleReport(args)} />,
  args: sampleDefaults,
  argTypes: {
    orgName: { control: 'text', name: 'Org name' },
    engineers: { control: { type: 'number', min: 1, max: 5000, step: 1 }, name: 'Engineers (seeds repos)' },
    repos: { control: { type: 'number', min: 0, max: 6000, step: 1 }, name: 'Repos (0 = derive from engineers)' },
  },
};

export default meta;
type Story = StoryObj<SampleInputs>;

export const Playground: Story = {};

export const Light: Story = { parameters: { theme: 'light' } };

export const Dark: Story = { parameters: { theme: 'dark' } };
