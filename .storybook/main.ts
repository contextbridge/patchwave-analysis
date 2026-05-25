import type { StorybookConfig } from '@storybook/react-vite';
import tailwindcss from '@tailwindcss/vite';
import { mergeConfig } from 'vite';

const config: StorybookConfig = {
  stories: ['../src/report/web/**/*.stories.@(js|jsx|mjs|ts|tsx)'],
  addons: [],
  framework: '@storybook/react-vite',
  // The report's production build uses bun-plugin-tailwind, but Storybook runs
  // on Vite, so the Tailwind v4 Vite plugin is wired in here rather than via a
  // root vite.config.ts (which would also leak into the vitest browser config).
  viteFinal: (viteConfig) => mergeConfig(viteConfig, { plugins: [tailwindcss()] }),
};

export default config;
