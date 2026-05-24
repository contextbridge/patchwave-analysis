# patchwave-analysis

A diagnostic CLI that measures Dependabot toil and CVE exposure across a GitHub org. Runs in your environment and writes a self-contained HTML report plus a raw-data zip. No data leaves your network unless you choose to share the generated artifacts.

## What it tells you

Given an org or user, the report covers:

- **Org overview** — repo count, public/private split, language mix, branch-protection coverage, active human committers
- **Dependabot coverage** — percent of repos with config, security-updates status, ecosystems, Node package manager split
- **PR backlog** — open vs merged vs closed in window, age buckets, bump-type split, time-to-merge p50/p90, CI status mix, dev-only-dep share
- **Stalled-PR signals** — repos at Dependabot's PR cap, repos with config but no recent PRs, reverts in window
- **People** — top human mergers and reviewers
- **Toil cost** — annualized engineer-time cost with browser-adjustable assumptions
- **CVE exposure** — open Dependabot security alerts by severity, oldest open Critical/High
- **Automation upside** — projected savings for common auto-merge rates

## Run it

You need a GitHub token with `repo` and `read:org` scopes (add `security_events` for CVE metrics). The CLI resolves it from `GITHUB_TOKEN`, then `GH_TOKEN`, then `gh auth token` — so if you're signed in with the `gh` CLI there's nothing to set.

### One-off run (recommended)

```sh
bash -c "$(curl -fsSL https://patchwave.ai/analyze.sh)"
```

This downloads the signed binary for your platform from the latest release, verifies its checksum, runs the interactive session, and cleans up after itself — nothing is installed. The report is written to your current directory. Pin a specific release with `PW_VERSION`:

```sh
PW_VERSION=v0.1.0 bash -c "$(curl -fsSL https://patchwave.ai/analyze.sh)"
```

### Download the binary yourself

Grab the archive for your platform from the [latest release](https://github.com/contextbridge/patchwave-analysis/releases/latest), then:

```sh
tar -xzf patchwave-analysis_darwin_arm64.tar.gz
./patchwave-analysis
```

### From source

```sh
git clone https://github.com/contextbridge/patchwave-analysis
cd patchwave-analysis
bun install
bun run build:report-web
bun run src/index.ts
```

For local report UI development:

```sh
bun run dev:report-web
```

## Options

```text
--window <Nd|Nw>     rolling time window (default 90d, e.g. 30d, 12w)
--out <basename>     output basename; writes <basename>.html and <basename>.zip
                     (default ./patchwave-report)
--include <repos>    comma-separated repo names to include
--exclude <repos>    comma-separated repo names to exclude
--help               show this help
```

## Output

Each run writes two siblings next to `--out`:

- **`<basename>.html`** — the self-contained browser report. Open it locally; it embeds the rolled-up report data in the file.
- **`<basename>.zip`** — the same HTML report plus every raw data slice behind it, one JSON file per slice. This is the artifact to send back when you want a deeper look from contextbridge.

The zip contains:

```text
patchwave-report.html           — interactive HTML report
README.txt                      — what's in the bundle
data/meta.json                  — CLI version, target, window, run options, top-level counts
data/aggregated.json            — rolled-up metrics that drive the report
data/repos.json                 — repo metadata
data/languages.json             — per-repo language byte counts
data/dependabot-config.json     — per-repo Dependabot config and ecosystems
data/dependabot-prs.json        — Dependabot PRs in the window (state, checks, reviewers)
data/cve.json                   — Dependabot security alert slices
data/reverts.json               — revert commits detected in the window
data/branch-protection.json     — default-branch protection slices
data/contributors.json          — active human committers per repo
data/warnings.json              — per-collector warnings suppressed during the crawl
```

Nothing in the report or bundle leaves your machine unless you choose to share it. The archive does not include tokens, secrets, or repository file contents.

## What it does not do

- It does not upload the report or any GitHub data. It only reads from `api.github.com`. Filesystem writes are limited to the `<basename>.html` / `<basename>.zip` pair under `--out` and a one-time anonymous-id file (see Telemetry).
- It does not keep a Markdown compatibility report.
- It does not auto-update.

## Telemetry

The CLI sends anonymous product analytics (PostHog) to help us understand how it's used. A random UUID is stored at `$XDG_CONFIG_HOME/contextbridge/anonymous_id` or `~/.config/contextbridge/anonymous_id` and shared across contextbridge tools. **Org names, repo names, tokens, and report contents are never sent** — only event counts and timings.

Events captured: `run_started` (window size, whether include/exclude was used), `run_completed` (repo/PR/warning counts and duration), `run_failed` (error kind and duration).

Opt out by setting any of:

- `DO_NOT_TRACK=1`
- `CONTEXTBRIDGE_TELEMETRY_DISABLED=1`
- `CI=1`

When disabled, no anonymous-id file is created and no events are sent.

## License

MIT.
