---
paths: ["src/**/*.ts", "src/**/*.tsx"]
globs: ["src/**/*.ts", "src/**/*.tsx"]
---

# Error Handling Neverthrow

- **Use neverthrow for safe wrappers around fallible I/O.** Wrap operations that can throw (file reads, JSON parsing, API calls) in `Result` types via `fromThrowable` for sync work and `ResultAsync.fromPromise` for promises. This keeps error handling explicit and chainable without try/catch blocks scattered through business logic.

  **Good:**

  ```typescript
  import { fromThrowable, Result, ResultAsync } from 'neverthrow';
  import { toError } from '#src/errors.ts';

  const safeRead = fromThrowable((path: string) => readFileSync(path, 'utf8').trim());
  const existing = safeRead(path).unwrapOr('');

  export const safeJsonParse = Result.fromThrowable((text: string) => JSON.parse(text) as unknown, toError);

  function fetchUser(id: string): ResultAsync<User, FetchError> {
    return ResultAsync.fromPromise(client.users.get(id), toFetchError);
  }
  ```

- **Use discriminated-union errors at module boundaries.** Each module that produces errors defines a small `XxxError` union with a `kind` discriminator. Downstream callers narrow by `kind` instead of `instanceof`. Keep the union flat — don't nest causes inside other unions.

- **Collectors and other long-running operations chain with `.andThen` / `.map` / `.mapErr`.** They never `throw`, never wrap a bare `await` over a fallible Promise, and never `try/catch`. If a sub-call returns `ResultAsync`, chain it; don't unwrap mid-flight.

- **The CLI entrypoint is the only place that unwraps.** It pattern-matches on the error type to format a human message, then sets a non-zero exit code. Do not use `unwrapOr` inside business logic when the fallback would silently hide a real bug — only at presentation boundaries where partial data is the intentional behavior.

- **Partial-failure boundaries are explicit.** When a per-item operation may fail and the run should continue (e.g. per-repo crawl where one repo's 403 shouldn't kill the report), the boundary that accepts partial failure handles the `Err` explicitly: log it, push a warning into the slice, and proceed with the successful items. Inside each per-item collector, no try/catch.

- **Tests assert on `Result` shapes.** Use `.isOk()`, `.isErr()`, `.unwrapOr(default)`, and value/error inspection — not try/catch. A test that catches a thrown error is a sign the production code should be returning a `Result`.
