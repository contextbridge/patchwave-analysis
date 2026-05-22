---
paths: ['src/**/*.test.ts']
globs: ['src/**/*.test.ts']
---

# Testing Patterns

- **Test factories use Fishery with `.build()` invocations.** Test data is constructed via Fishery `Factory.define<T>()` factories, never hand-rolled `createXxx()` helpers with inline object literals. Factories live next to the type they produce (e.g. `src/<area>/testFactories.ts`). Tests call `.build({ overrides })` to get fixture data.

  **Good:**

  ```typescript
  import { Factory } from 'fishery';
  import type { RepoMeta } from '#src/types.ts';

  export const repoMeta = Factory.define<RepoMeta>(() => ({
    owner: 'acme',
    name: 'widgets',
    visibility: 'private',
    archived: false,
    defaultBranch: 'main',
    primaryLanguage: 'TypeScript',
    pushedAt: '2026-01-01T00:00:00Z',
    dependabotSecurityUpdates: true,
  }));

  // In test:
  const repo = repoMeta.build({ archived: true });
  ```

- **Prefer `toMatchObject` for structured payload assertions.** When a test verifies several fields on the same object or nested payload, use one `expect(value).toMatchObject({ ... })` instead of a run of field-by-field assertions. Keep separate assertions for orthogonal behavior, clearer failure messages, or values that need a specialized matcher.

- **Use a shared deferred-promise helper; do not hand-roll it.** Tests that need manual promise resolution should import a single `createDeferred` helper. Do not recreate local `Deferred` types or `new Promise` wrappers in individual test files.

- **Assert on `Result` shapes, not on thrown errors.** Use `.isOk()`, `.isErr()`, `.unwrapOr(default)`, and value/error inspection — not try/catch. A test that catches a thrown error is a sign the production code should be returning a `Result` (see `error-handling-neverthrow.md`).
