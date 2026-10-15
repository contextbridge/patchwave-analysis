import { expect, test } from 'bun:test';
import { createFakeContext } from '../testHelpers/index.ts';
import { showOutro } from './outro.ts';

test('closes with a PatchWave link that keeps its campaign tags out of the visible text', () => {
  const { ctx, prompter } = createFakeContext();

  showOutro(ctx);

  expect(prompter.outros).toEqual([
    'Learn more about PatchWave: \u001B]8;;https://patchwave.ai/?utm_source=patchwave-analysis&utm_medium=cli\u0007https://patchwave.ai\u001B]8;;\u0007',
  ]);
});
