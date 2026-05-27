import type { z } from 'zod';

/**
 * Filters a list of raw GitHub response items to those matching `schema`,
 * reporting each dropped item via `onInvalid`. This is the runtime safety net
 * for the gap the type system can't close: GitHub sometimes returns data that
 * violates its own published contract (e.g. a commit `author` object with no
 * `login`), and octokit's generated types model that as a permissive
 * `Record<string, never>` arm, so `.login` type-checks but is `undefined` at
 * runtime. Validating against a schema that reflects reality turns such a
 * payload into a dropped item plus a warning instead of an uncaught crash.
 */
export function validateItems<T>(
  items: readonly unknown[],
  schema: z.ZodType<T>,
  onInvalid: (error: z.ZodError) => void,
): T[] {
  const valid: T[] = [];
  for (const item of items) {
    const result = schema.safeParse(item);
    if (result.success) valid.push(result.data);
    else onInvalid(result.error);
  }
  return valid;
}

/**
 * Reduces a ZodError to issue paths + codes for logging. Deliberately omits the
 * offending values, which can contain org/repo names we never emit (see the
 * telemetry guarantee in README.md).
 */
export function summarizeIssues(error: z.ZodError): Array<{ path: string; code: string }> {
  return error.issues.map((issue) => ({ path: issue.path.map(String).join('.'), code: issue.code }));
}
