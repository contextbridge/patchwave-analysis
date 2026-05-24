import type { Io } from '../BaseIo.ts';

export const NON_TTY_EXIT_CODE = 2;
export const NON_TTY_MESSAGE =
  'patchwave-analysis is an interactive CLI and requires a terminal.\n' +
  'Re-run it directly (no pipes/redirects) in an interactive shell.\n';

export type TtyGateResult = { ok: true } | { ok: false; code: number };

/**
 * Refuses to run when stdout isn't a TTY. The CLI is interactive end-to-end —
 * there are no `--share=...` / `--no-interactive` escape hatches — so a piped
 * or CI invocation has nowhere to render the share prompt and we'd rather
 * fail loudly than silently drop questions.
 */
export function enforceTty(io: Io): TtyGateResult {
  if (io.isStdoutTty()) return { ok: true };
  io.writeStderr(NON_TTY_MESSAGE);
  return { ok: false, code: NON_TTY_EXIT_CODE };
}
