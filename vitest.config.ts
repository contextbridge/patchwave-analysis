import react from '@vitejs/plugin-react';
import { playwright } from '@vitest/browser-playwright';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  resolve: {
    dedupe: ['react', 'react-dom'],
  },
  optimizeDeps: {
    include: [
      '@testing-library/jest-dom/vitest',
      '@testing-library/react',
      'react',
      'react-dom',
      'fishery',
      '@js-temporal/polyfill',
    ],
    entries: ['src/report/web/**/*.{ts,tsx}'],
  },
  test: {
    // Browser-only component tests use the `.browser.test.tsx` suffix so the split
    // from `bun test` (which owns `*.test.ts`) is obvious at a glance.
    include: ['src/**/*.browser.test.tsx'],
    setupFiles: ['./vitest.setup.ts'],
    browser: {
      enabled: true,
      provider: playwright(),
      instances: [
        {
          browser: 'chromium',
          headless: true,
        },
      ],
    },
  },
});
