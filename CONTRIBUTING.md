# Contributing to patchwave-analysis

## Setup

You need [`asdf`](https://asdf-vm.com/) installed and on your `PATH` (it manages the `bun` and `just` versions pinned in `.tool-versions`). Then:

```sh
git clone https://github.com/contextbridge/patchwave-analysis
cd patchwave-analysis
asdf install
just bootstrap          # asdf toolchain + bun install (husky git hooks install on bun install)
just run -- --help
```

## Repo layout

This is a single package with a flat `src/` tree:

```
src/
├── collectors/      per-slice GitHub data collectors (repos, PRs, CVEs, …)
├── github/          Octokit client wiring (retry + throttling)
├── heuristics/      derived metrics (toil cost, automation upside, …)
├── interactive/     Clack prompts (token walkthrough, share/open, banner, TTY gate)
├── prompt/          Prompter abstraction over @clack/prompts
├── report/          report aggregation + report/web/ React UI
├── upload/          artifact sharing
└── *.ts             CLI bootstrap, context (DI root), Octokit/IO/telemetry plumbing
```

## Development

Run the CLI locally (this builds the embedded report first):

```sh
just run                            # prompts for an org/user
just run contextbridge              # scan a specific org/user
```

Iterate on the embedded report UI with HMR, or browse components in Storybook:

```sh
just dev                            # report UI dev server (bun run dev:report-web)
just storybook                      # http://localhost:6006
```

## Testing

Run all checks with `just verify` (format, typecheck, lint, tests). For individual steps:

1. `bun run format` (Prettier)
2. `bun run typecheck`
3. `bun run lint` (ESLint)
4. `bun run test` — `test:unit` (bun:test over `src/**/*.test.ts`) then `test:browser` (vitest for the report UI)

Don't run a bare `bun test` at the repo root: Bun's runner walks the report UI's `.test.tsx` files, which only run under vitest. Use `bun run test`, or target a single file with `bun test ./src/<area>/foo.test.ts`.

## Coding conventions

See [`AGENTS.md`](./AGENTS.md) and the rule files under [`.claude/rules/`](./.claude/rules/).

## Pull requests

1. Use [Conventional Commits](https://www.conventionalcommits.org/) (`feat:`, `fix:`, `chore:`, etc.) for PR titles. The `Lint PR title` check enforces this, and the prefix decides changelog visibility (see `release-please-config.json`).
2. Follow the PR template [`.github/pull_request_template.md`](./.github/pull_request_template.md).
3. Ensure `just verify` runs without errors before opening the PR.

## Releases

Releases are cut by the ContextBridge team. Stable releases are automated by [release-please](https://github.com/googleapis/release-please) feeding into [goreleaser](https://goreleaser.com/):

- On every push to `main`, release-please opens (or updates) a release PR that bumps `CHANGELOG.md` from conventional-commit titles since the last release. Merging it creates the tag; goreleaser then compiles, signs/notarizes, and attaches the binaries. Don't edit `CHANGELOG.md` by hand.
- To validate the release build locally without publishing or notarizing, run `just release dry-run` (requires `goreleaser` on `PATH`).

## Code of conduct

Be kind. Assume good faith. If something feels off, email [`support@contextbridge.ai`](mailto:support@contextbridge.ai).
