---
paths: ['src/github/**/*.ts', 'src/collectors/**/*.ts']
globs: ['src/github/**/*.ts', 'src/collectors/**/*.ts']
---

# GitHub API interaction

How this CLI talks to `api.github.com`. These rules exist because violating them
silently returns **empty/zero results** (a confident, wrong $0) instead of failing
loudly — the worst outcome for a diagnostic tool. Most were learned the hard way.

## Batch with GraphQL `nodes(ids: […])`; never one request per repo

A 200-repo org crawled with per-repo REST/GraphQL calls blows past secondary rate
limits. Collect repo-scoped data in **batched GraphQL queries** keyed on repo node
IDs (`RepoMeta.nodeId`), the way `repoMetadata.ts` and `dependabotPrs.ts` do. One
query covers many repos. This is the whole point of PR #29 ("use more performant
GitHub APIs to avoid rate limiting").

- GraphQL and REST share **one** throttled Octokit client (the retry and throttling
  plugins are configured in `GithubClient.ts`), so they share a rate-limit budget.
  Don't construct a second client or bypass `GithubClient`.

## Never use the search API for private-repo data

> **Update (being revised):** This blanket ban was based on a misconfigured token.
> Verified against a real fine-grained token, `search` _does_ return private repos and
> exact counts (`author:`, `archived:`, `merged:`/`closed:` qualifiers all work). The
> count collector `src/collectors/dependabotPrCounts.ts` uses search deliberately for
> exact org-wide Dependabot PR counts. The guidance below still applies to per-repo
> _content_ fetching; this section will be rewritten as the search-first collection lands.

The GraphQL/REST **`search`** API silently omits private repositories when called
with a **fine-grained token** — it returns `200 OK` with the private matches missing,
no error. Fine-grained tokens are the least-privilege option the CLI recommends, so
this path produces a confident $0. Use **direct repo access** instead
(`nodes(ids:) { ... on Repository { pullRequests } }`), which works for both classic
and fine-grained tokens. Cross-check counts against a classic token and the search
API when changing collection logic (`gh auth token`); note search's `issueCount` is
approximate/eventually-consistent, so expect ±1.

## Tolerate partial GraphQL responses

GitHub returns usable `data` **alongside** an `errors` array when a token can read
some fields but not others — e.g. a fine-grained token without **Checks** access
hitting `statusCheckRollup` gets `FORBIDDEN` on those leaves while the PR list comes
back fine. Octokit's `graphql()` throws on _any_ `errors`, which would discard the
whole payload. `GithubClient.graphql` recovers the partial `data` from the thrown
`GraphqlResponseError` (`partialGraphqlData`). When you select an optional/permission-
gated field, assume some tokens can't read it and handle null sub-fields defensively.

## Keep GraphQL queries light, or they time out (502/504)

Deeply nested PR queries (PRs × reviews × comments × status-check contexts) exhaust
GitHub's resolver budget and return a gateway timeout — which, under partial-data
recovery, can come back as an empty `data` and **silently drop those repos**. Keep
the per-request work small: modest `BATCH_SIZE` (~10 repos), modest connection
`first:` counts (PRs ~30, nested ~20). Bigger isn't faster — it fails.

- **Any change to batch size or page `first:` counts must be verified against a real
  PR-heavy org, not just unit tests.** The mocks can't reproduce a timeout; a config
  that drops repos still passes `bun run test`. Confirm the live count is unchanged.

## Fail loudly, never silently empty

When the data genuinely can't be read, surface it (a warning, a degraded report
banner, or a pre-flight prompt) rather than returning `[]`. A diagnostic that
under-reports is worse than one that errors. Partial-failure boundaries log/warn and
proceed with what succeeded (see `error-handling-neverthrow.md`); they do not
manufacture a clean-looking zero.
