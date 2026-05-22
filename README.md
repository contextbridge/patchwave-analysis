# patchwave-analysis

A diagnostic CLI that measures Dependabot toil and CVE exposure across a GitHub org. Runs in your environment — no data leaves your network unless you choose to share the generated Markdown report.

## What it tells you

Given an org or user, the report covers:

- **Org overview** — repo count, public/private split, language mix, branch-protection coverage, active human committers
- **Dependabot coverage** — `% of repos with a config, security-updates status, ecosystems, Node package manager split
- **PR backlog** — open vs merged vs closed in window, age buckets, bump-type split, time-to-merge p50/p90, CI status mix, dev-only-dep share, "mechanical" (lockfile) failure share
- **Stalled-PR signals** — repos at Dependabot's 5-PR cap, repos with config but no recent PRs, sibling-bump pile-ups, reverts in window
- **People** — top mergers/reviewers, auto-merge usage
- **Toil cost** — engineer-hours/week and weekly cost at configurable comp
- **CVE exposure** — open Dependabot security alerts by severity, oldest open Critical/High
- **Recommendations** — concrete next steps based on what was found

## Run it

You need a GitHub token with `repo` and `read:org` scopes. For CVE metrics, add `security_events`.

### Option 1: with Bun installed

```sh
bunx patchwave-analysis@latest <your-org>
```

### Option 2: with the gh CLI installed

```sh
bunx patchwave-analysis@latest <your-org>
# auth is auto-resolved via `gh auth token`
```

### Option 3: from source

```sh
git clone https://github.com/contextbridge/patchwave-analysis
cd patchwave-analysis
bun install
bun run src/index.ts <your-org>
```

Token resolution order: `GITHUB_TOKEN` env var → `GH_TOKEN` env var → `gh auth token`.

## Options

```
--window <Nd|Nw>     rolling time window (default 90d, e.g. 30d, 12w)
--out <path>         markdown destination (default ./patchwave-report.md)
--include <repos>    comma-separated repo names to include
--exclude <repos>    comma-separated repo names to exclude
--help               show this help
```

## Output

A single Markdown file at `--out`. Open it locally, or paste it back to share.

## What it does not do

- It does not upload the report or any GitHub data. It only reads from `api.github.com`. Filesystem writes are limited to `--out` and a one-time anonymous-id file (see Telemetry).
- No auto-update.

## Telemetry

The CLI sends anonymous product analytics (PostHog) to help us understand how it's used. A random UUID is stored at `$XDG_CONFIG_HOME/contextbridge/anonymous_id` (or `~/.config/contextbridge/anonymous_id`) and shared across contextbridge tools. **Org names, repo names, tokens, and report contents are never sent** — only event counts and timings.

Events captured: `run_started` (window size, whether include/exclude was used), `run_completed` (repo/PR/warning counts and duration), `run_failed` (error kind and duration).

Opt out by setting any of:

- `DO_NOT_TRACK=1` — the cross-vendor convention
- `CONTEXTBRIDGE_TELEMETRY_DISABLED=1`
- `CI=1` — automatically disabled in CI environments

When disabled, no anonymous-id file is created and no events are sent.

## License

MIT.
