# PatchWave Dependency Checkup

PatchWave Dependency Checkup is a diagnostic CLI that measures Dependabot toil and CVE exposure across a GitHub org. It reads from the GitHub API and writes a self-contained HTML report you can use on its own, no PatchWave account needed.

![The top of a sample report for an org called acme. The headline reads "~131 hrs/year" spent triaging, reviewing, and merging Dependabot PRs. Below it, the report notes that 102 Dependabot updates are still open, 74 days on average, and that 7 known vulnerabilities are unpatched, including 1 critical and 3 high.](docs/report-screenshot.png)

## Run it

```sh
bash -c "$(curl -fsSL https://patchwave.ai/analyze.sh)"
```

This grabs the latest signed binary for your platform, verifies its checksum, runs the interactive session, then deletes the binary.

### Or grab the binary yourself

Download the archive for your platform from the [latest release](https://github.com/contextbridge/patchwave-analysis/releases/latest), then unpack and run it:

```sh
tar -xzf patchwave-analysis_darwin_arm64.tar.gz
./patchwave-analysis
```

## Setup

Easiest path: run `gh auth login --scopes "repo,read:org"` (via [GitHub CLI](https://cli.github.com)) and you're done. The CLI also reads `GITHUB_TOKEN` and `GH_TOKEN`, so you can pass a token directly instead.

The checkup needs a **classic** personal access token with two scopes:

- **`repo`** — your private repos and their pull-request data (this also covers `security_events` for the CVE numbers)
- **`read:org`** — listing the org's repos

Create one at [github.com/settings/tokens/new](https://github.com/settings/tokens/new), then export it and run:

```sh
export GITHUB_TOKEN=ghp_...
bash -c "$(curl -fsSL https://patchwave.ai/analyze.sh)"
```

Fine-grained tokens aren't supported, due to GitHub API restrictions. The CLI checks your token's scopes before scanning and tells you how to fix a missing one.

The CLI only reads from the API. It never writes.

Any org member can run the checkup, but only org owners and security managers get the full CVE section. Other accounts see security alerts only for repos where GitHub already shows them Dependabot alerts.

## Troubleshooting

**The report shows $0, or no Dependabot PRs.** Check the selected repos and any
collection warnings in the report. The estimate counts human reviews and merges in
the last 90 days, so zero can be a valid result. The checkup rejects missing token
scopes before scanning, but a token with the right scopes can still lack access to
some repos or require your org's SSO authorization.

**The CVE section says your account can't read the org's alerts.** Only org
owners and security managers can read every repo's Dependabot alerts. Ask one of
them to run the checkup.

**Your org isn't in the list to pick from.** Choose **"Other (type a name)"** and
enter the org's login directly.

## What it tells you

The report covers:

- **PR backlog:** open vs. merged vs. closed, age buckets, and time-to-merge
- **Stalled signals:** repos sitting at Dependabot's PR cap
- **CVE exposure:** open security alerts by severity, plus the oldest unpatched Critical/High
- **Toil cost:** annualized engineer-time, with assumptions you can adjust right in the browser
- **Automation upside:** projected savings with [PatchWave](https://patchwave.ai)

## What is PatchWave?

PatchWave is a GitHub app that automatically analyzes, fixes and merges your Dependabot PRs. Everyone gets 25 free PRs every month. No credit card required.

Paid plans start at $10 a month for 35 PRs total, including your 25 free PRs. All plans include analysis, fixing, and unlimited repositories and users. Only unused paid PRs roll over for one month. See [pricing](https://patchwave.ai/pricing) for larger allowances and volume discounts.

- [Sign up for free](https://app.patchwave.ai/join?utm_source=patchwave-analysis&utm_medium=readme)
- [Learn more at patchwave.ai](https://patchwave.ai/?utm_source=patchwave-analysis&utm_medium=readme)

## What it reads from GitHub

Everything comes from `api.github.com` over a fixed 90-day window. After choosing a target, the checkup asks whether to analyze all active repositories or choose a subset. For the selected repos (archived repos and forks are always skipped), it reads:

- The repo list, visibility, and primary-language metadata (plus whether Dependabot security updates are enabled)
- The open Dependabot PR backlog and PRs resolved in the window — state, timing, reviews, and who merged
- Open Dependabot security alerts, from the org-level endpoint when your account can use it and from each repo otherwise

All calls are read only. It writes nothing back to GitHub and reads no repository file contents.

## Output

When the scan finishes, the CLI writes `patchwave-report.html` to a fresh temporary directory and offers to open it in your default browser.

The report is one self-contained file with every metric baked in. It carries no tokens or source code, just the rolled-up numbers.

## Telemetry & privacy

The CLI sends anonymous usage events and crash reports so we can improve the tool. Usage events cover when a scan runs, how it ends, and counts such as repos and Dependabot PRs scanned; they never include org or repo names. Crash reports omit the machine hostname, request data, cookies, and HTTP bodies. Error messages and stack traces are included and may themselves contain org or repo names, tokens, or other sensitive details. See our [privacy policy](https://contextbridge.ai/privacy-policy).

The generated report stays on your machine and sends nothing. Its data, fonts, and images are embedded in the HTML file. Links to PatchWave include campaign tags that say which link you clicked, but no org or repo details.

To disable telemetry, set any of these in your environment:

- `DO_NOT_TRACK=1`
- `CONTEXTBRIDGE_TELEMETRY_DISABLED=1`

## Verify what you're running

The tool is open source (this repo, MIT) and its binaries are built from it by GitHub Actions. Every release archive ships with [GitHub build provenance](https://docs.github.com/actions/security-guides/using-artifact-attestations-to-establish-provenance-for-builds) — a Sigstore-signed attestation, recorded in a public transparency log, that ties the artifact to the source commit and workflow that built it. Verify a download with:

```sh
gh attestation verify patchwave-analysis_darwin_arm64.tar.gz --repo contextbridge/patchwave-analysis
```

macOS binaries are also signed and Apple-notarized.

## Contributing

Development setup, testing, and the release workflow live in [`CONTRIBUTING.md`](./CONTRIBUTING.md).

## License

MIT
