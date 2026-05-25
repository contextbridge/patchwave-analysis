# patchwave-analysis justfile

mod release 'just/release.just'

# Default recipe - list available commands
default:
    @just --list

# Install dependencies
install:
    bun install {{ if env("CI", "") != "" { "--frozen-lockfile" } else { "" } }}

# Full verification: format + typecheck + lint + test
verify: install
    bun run format:check
    bun run typecheck
    bun run lint
    bun run test

# Bootstrap development environment (asdf toolchain, deps, git hooks)
bootstrap:
    asdf install
    just install

# Run the CLI from source (builds the embedded report first). Pass an org/user as an argument.
run *args:
    bun run start {{ args }}

# Compile a host-platform binary (for cross-platform artifacts use `just release dry-run`)
build:
    bun run build:report-web
    bun build --compile ./src/index.ts --outfile dist/patchwave-analysis

# Run the embedded report UI dev server with HMR
dev:
    bun run dev:report-web

# Run Storybook for the report UI (http://localhost:6006)
storybook:
    bun run storybook
