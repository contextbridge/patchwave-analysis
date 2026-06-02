# [PatchWave](https://patchwave.ai) Analysis

PatchWave Analysis is a free diagnostic CLI that measures Dependabot toil and CVE exposure across a GitHub org. It reads from the GitHub API and writes a self-contained HTML report you can use on its own, no PatchWave account needed.

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

Easiest path: run `gh auth login` (via [GitHub CLI](https://cli.github.com)) and you're done. The CLI also reads `GITHUB_TOKEN` and `GH_TOKEN`, so you can pass a token directly instead.

Prefer a custom token? Create a [fine-grained token](https://github.com/settings/personal-access-tokens/new) instead and set these repository permissions to read:

- **Contents:** the `dependabot.yml` config
- **Pull requests:** the Dependabot PR backlog
- **Administration:** branch-protection and ruleset coverage
- **Dependabot alerts:** the CVE numbers

Then export it and run:

```sh
export GITHUB_TOKEN=github_pat_...
bash -c "$(curl -fsSL https://patchwave.ai/analyze.sh)"
```

Your org has to allow fine-grained tokens for this to reach its repos.

Whichever you pick, the CLI only reads from the API. It never writes.

## Troubleshooting

**The report shows $0, or no Dependabot PRs.** The token can read your security
alerts but not your pull requests, so the PR backlog comes back empty. A
fine-grained token needs the **Pull requests: Read** permission; a classic token
needs the **`repo`** scope. PatchWave checks for this before scanning and lets you
fix the token, so a $0 you didn't expect almost always means a missing permission.

**Your org isn't in the list to pick from.** Choose **"Other (type a name)"** and
enter the org's login directly.

## What it tells you

The report covers:

- **Dependabot coverage:** which repos have config, whether security updates are on, and for which ecosystems
- **PR backlog:** open vs. merged vs. closed, age buckets, and time-to-merge
- **Stalled signals:** repos sitting at Dependabot's PR cap, or configured but quiet
- **CVE exposure:** open security alerts by severity, plus the oldest unpatched Critical/High
- **Toil cost:** annualized engineer-time, with assumptions you can adjust right in the browser
- **Automation upside:** projected savings with [PatchWave](https://patchwave.ai)

## What it reads from GitHub

Everything comes from `api.github.com` over a fixed 90-day window. For the org and its repos (archived repos and forks are skipped), it reads:

- The repo list, visibility, and primary language metadata
- Dependabot PRs in the window, including state, timing, and reviews
- Open Dependabot security alerts (needs the `security_events` scope)
- Each repo's `.github/dependabot.yml`
- Branch-protection and ruleset settings on the default branch

All calls are read only. It writes nothing back to GitHub and pulls no file contents beyond the Dependabot config.

## Output

When the scan finishes, the CLI writes `patchwave-report.html` to a fresh temporary directory and offers to open it in your default browser.

The report is one self-contained file with every metric baked in. It carries no tokens or source code, just the rolled-up numbers.

## Telemetry & privacy

We send anonymous usage events and crash reports so we can improve the tool. Org names, repo names, tokens, report contents, and your hostname are never sent. We also do not ask if you want to share the report with us if you opt out of telemetry.

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
