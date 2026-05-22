/**
 * `@octokit/request` prints deprecation notices via `console.warn` for endpoints
 * scheduled to be removed in a future GitHub API version. They bypass our pino
 * logger, so silencing pino doesn't help. Replace the global `console.warn`
 * with a filtering wrapper that drops `[@octokit/...]` lines and forwards
 * everything else untouched.
 *
 * Safe to call multiple times — wrapping a wrapped warn just adds another
 * predicate to the chain.
 */
export function silenceOctokitDeprecation(): void {
  const console_ = globalThis.console;
  const originalWarn = console_.warn.bind(console_);
  console_.warn = (...args: unknown[]) => {
    const first = args[0];
    if (typeof first === 'string' && first.startsWith('[@octokit/')) return;
    originalWarn(...args);
  };
}
