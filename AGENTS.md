# AGENTS.md

## Project: patchwave-analysis

A diagnostic CLI that measures Dependabot toil and CVE exposure across a GitHub org. It runs in the user's environment, crawls `api.github.com`, and writes a self-contained HTML report to a temporary directory. No data leaves the user's network unless they choose to share the generated report.

The single entrypoint is `patchwave-analysis [<org-or-user>]` — an interactive session that prompts for the target if omitted, then whether to share the report when the scan finishes. There are no other flags; the time window (90 days) is fixed.

## Stack

- **Runtime:** Bun (the binary is `bun build --compile`d; see `.goreleaser.yaml`).
- **Language:** TypeScript (strict).
- **Layout:** single package, flat `src/` tree. No workspaces, no monorepo.
- **Report UI:** React + Tailwind, built into `dist/report-web/index.html` and embedded into the binary via a `with { type: 'text' }` import. Browser tests use **vitest** (browser mode via Playwright/Chromium); CLI tests use **bun:test**.

## Repository layout

```
patchwave-analysis/
├── src/
│   ├── collectors/        per-slice GitHub data collectors (repos, PRs, CVEs, …)
│   ├── github/            Octokit client wiring (retry + throttling plugins)
│   ├── heuristics/        derived metrics (toil cost, automation upside, …)
│   ├── interactive/       Clack prompts: token walkthrough, share/open, banner, TTY gate
│   ├── prompt/            Prompter abstraction over @clack/prompts
│   ├── report/            report aggregation + `report/web/` React UI
│   ├── upload/            artifact sharing
│   ├── testHelpers/       shared test utilities
│   ├── context.ts         CliContext DI root (see Conventions)
│   ├── cli.ts             arg parsing + main()
│   └── index.ts           bootstrap: telemetry/logger/analytics wiring, then main()
├── scripts/               analyze.sh installer + build-report-web.ts
├── .goreleaser.yaml       cross-platform compile + macOS notarize
└── justfile               root-level recipes
```

## Verification

Before marking a task complete, run `just verify` and fix anything that fails. It runs four steps in order:

- `bun run format:check` — Prettier
- `bun run typecheck` — strict `tsc --noEmit` (builds the web report first)
- `bun run lint` — ESLint (`--max-warnings 0`)
- `bun run test` — dispatches `test:unit` (bun:test over `src/**/*.test.ts`) then `test:browser` (vitest)

Do **not** run a bare `bun test` at the repo root — Bun's runner would walk the report UI's `.test.tsx` files, which depend on a real DOM and only run under vitest. Use `bun run test` (the dispatch script) or a targeted `bun test ./src/<area>/foo.test.ts` during iteration.

## Pull requests

Before opening a PR, read `.github/pull_request_template.md` and follow it exactly — title rules (Conventional Commits, chosen by changelog visibility per `release-please-config.json`), the Summary/Review-focus/Commits sections, and the commit-hygiene guidance.

## Conventions

The following files under `.claude/rules/` carry team conventions enforced for `src/`. Read the relevant one before editing matching files:

- [Error Handling Neverthrow](.claude/rules/error-handling-neverthrow.md) — no try/catch in business logic; wrap fallible I/O in `Result` / `ResultAsync`.
- [Context Interfaces and Fakes](.claude/rules/context-interfaces-and-fakes.md) — injected dependencies get a narrow public interface plus a separate real implementation.
- [Testing Patterns](.claude/rules/testing-patterns.md) — test data comes from Fishery factories (`testFactories.ts`), never hand-rolled `createXxx()` helpers.
- [Bun-native APIs](.claude/rules/bun-native-apis.md) — reach for `Bun.*` globals before the Node equivalent.
- [Bun testing](.claude/rules/bun-testing.md) — non-obvious `bun:test` conventions.

Beyond the rules:

- **Dependency injection is non-negotiable.** All business logic flows through the typed `CliContext` (`src/context.ts`). Prefer explicit context-object wiring over module-level singletons or global mocking.
- **`ctx` always comes first, and is destructured at the point of use.** Helpers that take a context list it as the first parameter (`fn(ctx, other)`); pull the fields you need at the top of the body (`const { io, logger } = ctx;`) rather than reaching through `ctx.io.stdout` at each call site. This narrows each function to the surface it depends on and keeps test stubs honest.
- **Business output (stdout) and diagnostics (logger → stderr) stay on separate channels** so piped consumers see clean stdout while humans get readable logs.
- **Use Temporal for all time handling.** Use `@js-temporal/polyfill` via `src/time.ts`, keep in-process values as Temporal objects, serialize only ISO strings at JSON boundaries, and do not use `Date`.
- **In Zod string schemas, prefer `.nonempty()` over `.min(1)`** (`.trim().nonempty()` when surrounding whitespace should not count).
- **Destructured defaults over `??` fallbacks.** Apply defaults in a single destructuring assignment — `const { version = '0.0.1' } = input;`, not per-field `??`.
- **Helpers at the bottom of files.** Primary exports come first; module-local helpers and factories sit below them. In test files they live after all `describe()` blocks.
- **The product is always "PatchWave" in prose and UI copy** — capital P and W, one word. Never "patchwave", "Patchwave", or "patch wave". The only lowercase forms are literal identifiers that must match their real-world spelling: the `patchwave-analysis` CLI/binary name, the `patchwave-report.html` artifact, and the `patchwave.ai` domain.

### File naming

- **camelCase** for `.ts` / `.tsx` files (`cli.ts`, `context.ts`, `tokenWalkthrough.ts`).
- **PascalCase when a file's primary export is a module-level class**, matching the class name (`Telemetry.ts` exports `class …`, `IoImpl.ts`, `BrowserOpener.ts`). Test files follow the same casing.
- Tooling-mandated filenames (`tsconfig.json`, `package.json`, `eslint.config.mjs`, workflow files, etc.) follow upstream conventions.
- Directory names are lowercase. Tests are co-located next to the implementation (`cli.ts` → `cli.test.ts`); no `__tests__/` or top-level `tests/` tree.

### Imports

Use relative imports with explicit `.ts` / `.tsx` extensions (`import { main } from './cli.ts';`). This is a single package — there are no subpath (`#src/*`) or cross-package (`@scope/*`) imports.

## Telemetry

Instrumentation (PostHog analytics + Sentry crash reporting, gated by build-time keys) is wired in `src/index.ts`. `Sentry.init` must run before `createLogger` so its `pinoIntegration` subscribes to pino's diagnostics channel first. Org names, repo names, tokens, report contents, and the machine hostname are never sent — see the "Telemetry & privacy" section of `README.md` for the full guarantee.
