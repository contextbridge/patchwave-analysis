---
paths: ['src/github/**/*.ts', 'src/collectors/**/*.ts']
globs: ['src/github/**/*.ts', 'src/collectors/**/*.ts']
---

# GitHub API interaction

How this CLI talks to `api.github.com`. These rules exist because violating them
silently returns **empty/zero results** (a confident, wrong $0) instead of failing
loudly — the worst outcome for a diagnostic tool. Most were learned the hard way.

## Classic tokens only; validate scopes up front

The CLI requires a **classic PAT** with `repo` and `read:org` (`repo` also covers
`security_events`). Fine-grained tokens are unsupported: GitHub's `search` API
silently omits private repos under a fine-grained token, which would surface as a
confident $0. The scope pre-flight (`cli.ts runPreflight` → `GithubClient.getOAuthScopes`,
reading the `x-oauth-scopes` header) rejects fine-grained/unscoped tokens before any
crawl. Don't add token-type branching elsewhere — gate once, up front.

## One throttled client; share its rate-limit budget

GraphQL and REST share **one** Octokit instance (the retry and throttling plugins are
configured in `GithubClient.ts`), so they share a rate-limit budget and bounded
secondary-rate-limit backoff. Don't construct a second client or bypass `GithubClient`.
This is what keeps a large org off the secondary rate limit (PR #29).

## PR collection: `search`, bisected to beat the 1000-result cap

Dependabot PRs come from org-wide GraphQL `search` (`dependabotPrs.ts`), not per-repo
fan-out — search returns the per-PR review/merge data the cost model needs in one
stream. But **search returns at most 1000 results per query** (`hasNextPage` stops at
1000 even when `issueCount` is larger). A single `created:>=`/`closed:>=` query would
silently undercount a busy org, so `searchAllPrs` **bisects the date range** until every
sub-query fits under the cap. Never replace this with a single capped query. A single
day that still exceeds 1000 is `logger.error`'d (truncation we can't avoid), not dropped.

## CVEs: the org-level endpoint, with a per-repo fallback

CVE alerts come from `GET /orgs/{org}/dependabot/alerts` (one call), falling back to
per-repo only on scope-missing. Keep it that way — per-repo CVE crawls inflate request
count.

## Defensively read every GraphQL response; never trust codegen's non-null types

GitHub omits `search`/`nodes` or returns null leaves on timeouts and gateway hiccups,
even though codegen types them non-null. Read every level through guards
(`res?.search?.nodes ?? []`, `pageInfo?.endCursor ?? null`, skip a node missing
`repository`) — never dereference a field the server may omit. `GithubClient.graphql`
also recovers the partial `data` Octokit would otherwise discard from a thrown
`GraphqlResponseError`. The cautionary case is the crash
`TypeError: undefined is not an object (evaluating 'res.nodes')`.

## Fail loudly via `logger.error`, never silently empty

When data can't be read or a response is malformed, **`logger.error`** it — that's the
only level wired to Sentry (`pinoIntegration`), so it both surfaces the problem and lets
us track how often collection degrades. This covers would-be crashes (missing non-null
fields, an `issueCount > 0` but `0 PRs mapped` mismatch) and data-completeness
degradation (a repo 403, scope-missing CVE, a salvaged partial response). Then degrade
gracefully — record a `CollectorWarning` and proceed with what succeeded; do not
manufacture a clean-looking zero. `logger.warn` is for incidental noise only.
