---
paths: ["src/**/*.test.ts"]
globs: ["src/**/*.test.ts"]
---

# Bun testing conventions

Conventions specific to `bun:test` that are non-obvious and have bitten us.

## `.rejects` / `.resolves` matchers are synchronous — don't `await`, don't `async`, don't `nextTick`

`expect(promise).rejects.toX()` and `expect(promise).resolves.toX()` **block synchronously at runtime** via `globalThis.bunVM().waitForPromise(...)`. `bun-types` types them as returning `void` — the types are wrong and [upstream closed the fix as "not planned"](https://github.com/oven-sh/bun/issues/15457).

**Correct pattern:**

```ts
it('rejects on X', () => {
  expect(fn(...)).rejects.toBeInstanceOf(SomeError);
  expect(io.stderr.text()).toContain('expected message');
});
```

No `async`, no `await`, no manual `nextTick` flush.

**Why:** adapting Jest habits to Bun produces an antagonistic lint/TS pair:

- With `await expect(...).rejects.toX()` → TS80007 "`await` has no effect on the type of this expression" (the matcher is typed `void`).
- Without `await` → `@typescript-eslint/require-await` flags `async` as pointless.

Dropping both resolves both. The matcher still works — it already blocks the thread.

**`nextTick` is also unnecessary.** Some older tests have:

```ts
// CARGO-CULT — DO NOT COPY
it('rejects on X', async () => {
  expect(fn(...)).rejects.toBeInstanceOf(SomeError);
  await nextTick();
  expect(readErrorLogs(logs).some(...)).toBe(true);
});
```

That helper is a leftover from Jest patterns. `waitForPromise` already settled the promise, and stream-backed reads are ready immediately on the next line.

**Keep `async` only when the body has a real `await`** — e.g. `await runHandler(ctx)` on a happy path, or async fixture setup. Don't keep it "just in case."

**Don't try to patch the types.** `Matchers.resolves` / `Matchers.rejects` are typed as property accessors on an interface; TS declaration merging can only add, not override. A local wrapper helper would work, but Bun's synchronous behavior makes it unnecessary.
