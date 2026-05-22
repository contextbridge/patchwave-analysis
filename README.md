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

- It does not upload anything. No telemetry, no auto-update.
- It only reads from `api.github.com`. Filesystem writes are limited to `--out`.

## License

MIT.
