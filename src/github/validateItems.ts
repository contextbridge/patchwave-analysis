import type { z } from 'zod';

/** Keeps malformed GitHub list items from crashing collectors. */
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

/** Omits offending values so logs never include org/repo names. */
export function summarizeIssues(error: z.ZodError): Array<{ path: string; code: string }> {
  return error.issues.map((issue) => ({ path: issue.path.map(String).join('.'), code: issue.code }));
}
