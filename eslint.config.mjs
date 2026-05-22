import baseConfig from '@contextbridge-ai/eslint-config/base';
import { defineConfig } from 'eslint/config';

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
    ignores: ['dist/**', 'node_modules/**', 'coverage/**', 'claude-tmp/**', 'bun.lock'],
  },
  {
    files: ['src/**/*.ts'],
    rules: {
      'no-restricted-syntax': ['error', consoleRestrictedSelector],
      'no-restricted-properties': ['error', ...processRestrictedProperties],
    },
  },
);
