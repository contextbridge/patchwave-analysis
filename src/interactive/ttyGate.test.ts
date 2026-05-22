import { expect, test } from 'bun:test';
import { FakeIo } from '../testHelpers/index.ts';
import { NON_TTY_EXIT_CODE, NON_TTY_MESSAGE, enforceTty } from './ttyGate.ts';

test('passes through when stdout is a TTY', () => {
  const io = new FakeIo({ isStdoutTty: true });
  expect(enforceTty(io)).toEqual({ ok: true });
  expect(io.stderr.text()).toBe('');
});

test('writes the no-terminal message and returns exit code 2 in non-TTY mode', () => {
  const io = new FakeIo({ isStdoutTty: false });
  const result = enforceTty(io);
  expect(result).toEqual({ ok: false, code: NON_TTY_EXIT_CODE });
  expect(io.stderr.text()).toContain('interactive CLI and requires a terminal');
  expect(io.stderr.text()).toBe(NON_TTY_MESSAGE);
});
