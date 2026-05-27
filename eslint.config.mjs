import baseConfig from '@contextbridge-ai/eslint-config/base';
import { defineConfig } from 'eslint/config';

// Flat-config array-valued rules (like no-restricted-syntax) are REPLACED, not
// merged, when a later matching block sets the same rule. Keep the shared
// selectors here so scoped blocks can include them alongside their own.
const dateRestrictedSelectors = [
  {
    selector: 'NewExpression[callee.name="Date"]',
    message: 'Use Temporal from ./src/time.ts instead of Date.',
  },
  {
    selector: 'CallExpression[callee.name="Date"]',
    message: 'Use Temporal from ./src/time.ts instead of Date.',
  },
  {
    selector: 'CallExpression[callee.object.name="Date"][callee.property.name="now"]',
    message: 'Use Temporal from ./src/time.ts instead of Date.now().',
  },
  {
    selector: 'CallExpression[callee.object.name="Date"][callee.property.name="parse"]',
    message: 'Use Temporal from ./src/time.ts instead of Date.parse().',
  },
  {
    selector: 'CallExpression[callee.object.name="Date"][callee.property.name="UTC"]',
    message: 'Use Temporal from ./src/time.ts instead of Date.UTC().',
  },
];

const consoleRestrictedSelector = {
  selector: "CallExpression[callee.object.name='console']",
  message:
    'Do not use console.* — use ctx.logger for diagnostics (writes to stderr) and ctx.io.writeStdout for business output.',
};

const processRestrictedProperties = [
  {
    object: 'process',
    property: 'stdout',
    message: 'Use ctx.io.writeStdout (see DI conventions in .claude/rules).',
  },
  {
    object: 'process',
    property: 'stderr',
    message: 'Use ctx.logger or ctx.io.writeStderr (see DI conventions in .claude/rules).',
  },
];

export default defineConfig(
  ...baseConfig,
  {
    ignores: [
      'dist/**',
      'node_modules/**',
      'coverage/**',
      'storybook-static/**',
      'claude-tmp/**',
      'bun.lock',
      'src/github/graphql/generated.ts',
    ],
  },
  {
    rules: {
      'no-restricted-syntax': ['error', ...dateRestrictedSelectors],
    },
  },
  {
    files: ['src/**/*.ts'],
    rules: {
      'no-restricted-syntax': ['error', ...dateRestrictedSelectors, consoleRestrictedSelector],
      'no-restricted-properties': ['error', ...processRestrictedProperties],
    },
  },
);
