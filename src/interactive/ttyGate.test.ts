import { expect, test } from 'bun:test';
import { FakeIo } from '../testHelpers/index.ts';
import { NON_TTY_EXIT_CODE, NON_TTY_MESSAGE, enforceTty } from './ttyGate.ts';

test('passes through when attached to an interactive terminal', () => {
  const io = new FakeIo({ isTty: true });
  expect(enforceTty(io)).toEqual({ ok: true });
  expect(io.stderr.text()).toBe('');
});

test('writes the no-terminal message and returns exit code 2 in non-TTY mode', () => {
  const io = new FakeIo({ isTty: false });
  const result = enforceTty(io);
  expect(result).toEqual({ ok: false, code: NON_TTY_EXIT_CODE });
  expect(io.stderr.text()).toContain('interactive CLI and requires a terminal');
  expect(io.stderr.text()).toBe(NON_TTY_MESSAGE);
});
