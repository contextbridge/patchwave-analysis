# Changelog

## [2.0.0](https://github.com/contextbridge/patchwave-analysis/compare/v1.0.1...v2.0.0) (2026-11-20)


### ⚠ BREAKING CHANGES

* **deps-dev:** GraphQL 14 and 15 are no longer supported. The <code>graphql</code> peer dependency is now <code>^16.0.0 || ^17.0.0</code>, so upgrade <code>graphql</code> to version 16 or 17 before updating to this version.</p> </li> <li> <p><a href="https://redirect.github.com/dotansimha/graphql-code-generator/pull/11075">#11075</a> <a href="https://github.com/dotansimha/graphql-code-generator/commit/fa49a3725bf269abf07616b5df1336cf86a4838d"><code>fa49a37</code></a> Thanks <a href="https://github.com/eddeee888"><code>@​eddeee888</code></a>! - Node.js versions below 22.18.0 are no longer supported. Upgrade to Node.js 22.18.0 or later before updating to this version.</p> </li> <li> <p><a href="https://redirect.github.com/dotansimha/graphql-code-generator/pull/11075">#11075</a> <a href="https://github.com/dotansimha/graphql-code-generator/commit/fa49a3725bf269abf07616b5df1336cf86a4838d"><code>fa49a37</code></a> Thanks <a href="https://github.com/eddeee888"><code>@​eddeee888</code></a>! - Remove the deprecated <code>emitLegacyCommonJSImports</code> config option and the <code>--emit-legacy-common-js-imports</code> CLI flag</p> <p>Use <code>importExtension</code> (or <code>--import-extension</code>) to set the extension appended to relative imports. When <code>importExtension</code> is not set, no extension is appended.</p> <p><code>@graphql-codegen/plugin-helpers</code> no longer exports <code>normalizeImportExtension</code>. Use <code>importExtension ?? ''</code> instead.</p> <p>Migration:</p> <pre lang="diff"><code> const config: CodegenConfig = {
    -  emitLegacyCommonJSImports: false,
    +  importExtension: '.js',
     };
    </code></pre>
    </li>
    </ul>
    <h3>Minor Changes</h3>
    <ul>
    <li>
    <p><a
    href="https://redirect.github.com/dotansimha/graphql-code-generator/pull/11103">#11103</a>
    <a
    href="https://github.com/dotansimha/graphql-code-generator/commit/409ffbfda5c56d6f46f0e0a4045c547714df2264"><code>409ffbf</code></a>
    Thanks <a
    href="https://github.com/jerelmiller"><code>@​jerelmiller</code></a>! -
    Add support for graphql v17 fragment
    arguments (<code>experimentalFragmentArguments</code>).</p>
    <p>To use fragment arguments, set the parser option in the root
    <code>config</code>:</p>
    <pre lang="ts"><code>const config: CodegenConfig = {
      config: { experimentalFragmentArguments: true }
      // ...
    }
    </code></pre>
    </li>
    </ul>
    <!-- raw HTML omitted -->
    </blockquote>
    <p>... (truncated)</p>
    </details>
    <details>
    <summary>Commits</summary>
    <ul>
    <li><a
    href="https://github.com/dotansimha/graphql-code-generator/commit/e5a5669f4197c6db561956a9b4c47244d4e29b48"><code>e5a5669</code></a>
    chore(release): update monorepo packages versions (<a
    href="https://github.com/dotansimha/graphql-code-generator/tree/HEAD/packages/plugins/typescript/operations/issues/11085">#11085</a>)</li>
    <li><a
    href="https://github.com/dotansimha/graphql-code-generator/commit/409ffbfda5c56d6f46f0e0a4045c547714df2264"><code>409ffbf</code></a>
    Add support for GraphQL 17 experimental fragment arguments (<a
    href="https://github.com/dotansimha/graphql-code-generator/tree/HEAD/packages/plugins/typescript/operations/issues/11103">#11103</a>)</li>
    <li><a
    href="https://github.com/dotansimha/graphql-code-generator/commit/fa49a3725bf269abf07616b5df1336cf86a4838d"><code>fa49a37</code></a>
    Next major feature branch (<a
    href="https://github.com/dotansimha/graphql-code-generator/tree/HEAD/packages/plugins/typescript/operations/issues/11075">#11075</a>)</li>
    <li><a
    href="https://github.com/dotansimha/graphql-code-generator/commit/11ac951a30b79369d3b0aa78f83a79d309ffcc77"><code>11ac951</code></a>
    test: copy dev-test fixtures into package tests (<a
    href="https://github.com/dotansimha/graphql-code-generator/tree/HEAD/packages/plugins/typescript/operations/issues/11098">#11098</a>)</li>
    <li><a
    href="https://github.com/dotansimha/graphql-code-generator/commit/cbefcf33b7fde93d3a44c337a4edb5f32ab38fdb"><code>cbefcf3</code></a>
    Revert &quot;chore: update <a
    href="https://github.com/graphql-tools"><code>@​graphql-tools</code></a>
    to latest majors and drop Node below 22....</li>
    <li><a
    href="https://github.com/dotansimha/graphql-code-generator/commit/1161d66e36bb074809849cca9367213deed9c443"><code>1161d66</code></a>
    chore: update <a
    href="https://github.com/graphql-tools"><code>@​graphql-tools</code></a>
    to latest majors and drop Node below 22.18 and g...</li>
    <li>See full diff in <a
    href="https://github.com/dotansimha/graphql-code-generator/commits/@graphql-codegen/typescript-operations@7.0.0/packages/plugins/typescript/operations">compare
    view</a></li>
    </ul>
    </details>
    <br />

### Build

* **deps-dev:** bump @graphql-codegen/typescript-operations from 6.2.0 to 7.0.0 ([#96](https://github.com/contextbridge/patchwave-analysis/issues/96)) ([745aa38](https://github.com/contextbridge/patchwave-analysis/commit/745aa381576d6721ecda24271a421e5ac08b6677))

## [1.0.1](https://github.com/contextbridge/patchwave-analysis/compare/v1.0.0...v1.0.1) (2026-10-19)


### Bug Fixes

* align signup messaging with monthly free PR pricing ([#83](https://github.com/contextbridge/patchwave-analysis/issues/83)) ([6a4c0c6](https://github.com/contextbridge/patchwave-analysis/commit/6a4c0c6c77af646224b0de5193416225276607f0))

## [1.0.0](https://github.com/contextbridge/patchwave-analysis/compare/v0.7.1...v1.0.0) (2026-10-15)


### Features

* rebrand the checkup as a PatchWave on-ramp and remove report analytics ([#76](https://github.com/contextbridge/patchwave-analysis/issues/76)) ([4c09944](https://github.com/contextbridge/patchwave-analysis/commit/4c09944597ffc124ca0f226ec5a816a6a113873c))

## [0.7.1](https://github.com/contextbridge/patchwave-analysis/compare/v0.7.0...v0.7.1) (2026-09-21)


### Bug Fixes

* replace report sharing with marketing CTAs ([#62](https://github.com/contextbridge/patchwave-analysis/issues/62)) ([3c37b5b](https://github.com/contextbridge/patchwave-analysis/commit/3c37b5b3a6f2cd5b672e7c5f0546d26e61527b7e))

## [0.7.0](https://github.com/contextbridge/patchwave-analysis/compare/v0.6.0...v0.7.0) (2026-06-26)


### Features

* retry transient S3 upload failures with richer telemetry ([#51](https://github.com/contextbridge/patchwave-analysis/issues/51)) ([02f4b9f](https://github.com/contextbridge/patchwave-analysis/commit/02f4b9f9eb03dc7a44efaca9a087718b0843f79b))

## [0.6.0](https://github.com/contextbridge/patchwave-analysis/compare/v0.5.0...v0.6.0) (2026-06-12)


### Features

* Filter repos in tui before script runs ([#49](https://github.com/contextbridge/patchwave-analysis/issues/49)) ([d9cc6e1](https://github.com/contextbridge/patchwave-analysis/commit/d9cc6e1625eaa0e776d0bf8955fc3e7900b069dc))
* report inaccessible CVE data instead of a false "no open alerts" ([#48](https://github.com/contextbridge/patchwave-analysis/issues/48)) ([01adcff](https://github.com/contextbridge/patchwave-analysis/commit/01adcff9d9146930f90b4b556ef1166815b6d449))

## [0.5.0](https://github.com/contextbridge/patchwave-analysis/compare/v0.4.0...v0.5.0) (2026-06-11)


### Features

* credit accelerated reviews in the PatchWave savings estimate ([#45](https://github.com/contextbridge/patchwave-analysis/issues/45)) ([328c243](https://github.com/contextbridge/patchwave-analysis/commit/328c243fea4d069ea2b81a1f15364d8dbeb44d8e))

## [0.4.0](https://github.com/contextbridge/patchwave-analysis/compare/v0.3.0...v0.4.0) (2026-06-11)


### Features

* allow switching the report between hours and dollars ([1eaed34](https://github.com/contextbridge/patchwave-analysis/commit/1eaed3466f9a3bcc7444f5bb075eab847b7305e6))

## [0.3.0](https://github.com/contextbridge/patchwave-analysis/compare/v0.2.7...v0.3.0) (2026-06-04)


### Features

* Show how we get to the number with our topline assumptions ([#38](https://github.com/contextbridge/patchwave-analysis/issues/38)) ([6a7aad0](https://github.com/contextbridge/patchwave-analysis/commit/6a7aad04df2477ac24d07aa162eaa17783dadf15))
* validate GitHub token scopes before crawling ([775f4f2](https://github.com/contextbridge/patchwave-analysis/commit/775f4f2ef094a9c4538b155dda459f027a31460e))

## [0.2.7](https://github.com/contextbridge/patchwave-analysis/compare/v0.2.6...v0.2.7) (2026-06-02)


### Bug Fixes

* make Dependabot PR collection work with fine-grained tokens ([#36](https://github.com/contextbridge/patchwave-analysis/issues/36)) ([46acf02](https://github.com/contextbridge/patchwave-analysis/commit/46acf0209d3e20352595f5390b6c1de2c625f8de))

## [0.2.6](https://github.com/contextbridge/patchwave-analysis/compare/v0.2.5...v0.2.6) (2026-06-01)


### Bug Fixes

* auto-opt out of share prompt with disabled telemetry ([a176524](https://github.com/contextbridge/patchwave-analysis/commit/a1765249253d265b737d4d4ea4e96c3c39114db2))

## [0.2.5](https://github.com/contextbridge/patchwave-analysis/compare/v0.2.4...v0.2.5) (2026-05-29)


### Bug Fixes

* publish verifiable build provenance for releases ([#32](https://github.com/contextbridge/patchwave-analysis/issues/32)) ([560aeee](https://github.com/contextbridge/patchwave-analysis/commit/560aeeeb6aa42626d224e5870d60a5d5e38b1e14))

## [0.2.4](https://github.com/contextbridge/patchwave-analysis/compare/v0.2.3...v0.2.4) (2026-05-28)


### Bug Fixes

* use more performant GitHub APIs to avoid rate limiting ([#29](https://github.com/contextbridge/patchwave-analysis/issues/29)) ([5564e47](https://github.com/contextbridge/patchwave-analysis/commit/5564e479fded9828516de0b2ed20ffc700de8b10))

## [0.2.3](https://github.com/contextbridge/patchwave-analysis/compare/v0.2.2...v0.2.3) (2026-05-27)


### Bug Fixes

* open the report automatically instead of prompting ([#24](https://github.com/contextbridge/patchwave-analysis/issues/24)) ([ba580d9](https://github.com/contextbridge/patchwave-analysis/commit/ba580d982d31e068c0782fdf3187dbe3e3c5ddaa))
* type and validate GitHub responses against real schemas ([#23](https://github.com/contextbridge/patchwave-analysis/issues/23)) ([b00cde7](https://github.com/contextbridge/patchwave-analysis/commit/b00cde74ccadf202586f381f79c4750efee85293))

## [0.2.2](https://github.com/contextbridge/patchwave-analysis/compare/v0.2.1...v0.2.2) (2026-05-27)


### Bug Fixes

* guard against commit author with no login ([#21](https://github.com/contextbridge/patchwave-analysis/issues/21)) ([75097bf](https://github.com/contextbridge/patchwave-analysis/commit/75097bfe5523ec79b0de9a4d7db40cd0a149bf80))

## [0.2.1](https://github.com/contextbridge/patchwave-analysis/compare/v0.2.0...v0.2.1) (2026-05-27)


### Bug Fixes

* **report:** clean up repo lists in the risk story ([#19](https://github.com/contextbridge/patchwave-analysis/issues/19)) ([4d71a9e](https://github.com/contextbridge/patchwave-analysis/commit/4d71a9e40b1f8a18208ed3548cff9426c67017cc))

## [0.2.0](https://github.com/contextbridge/patchwave-analysis/compare/v0.1.1...v0.2.0) (2026-05-27)


### Features

* **report:** lead with the solution and apply review feedback ([#17](https://github.com/contextbridge/patchwave-analysis/issues/17)) ([dbad8d8](https://github.com/contextbridge/patchwave-analysis/commit/dbad8d8da55fa5d3f6d44b54ee2ca513b209528c))

## [0.1.1](https://github.com/contextbridge/patchwave-analysis/compare/v0.1.0...v0.1.1) (2026-05-27)


### Bug Fixes

* stop analyze.sh from hanging at interactive prompts ([#15](https://github.com/contextbridge/patchwave-analysis/issues/15)) ([e894145](https://github.com/contextbridge/patchwave-analysis/commit/e894145051a51d9ad266d3edfa24c255def09a73))

## [0.1.0](https://github.com/contextbridge/patchwave-analysis/compare/v0.0.1...v0.1.0) (2026-05-26)


### Features

* add interactive prompts and report sharing ([#4](https://github.com/contextbridge/patchwave-analysis/issues/4)) ([23e8543](https://github.com/contextbridge/patchwave-analysis/commit/23e8543b9bd066d9eb780ea6aa11c93a561c281c))
* bootstrap repo ([57653df](https://github.com/contextbridge/patchwave-analysis/commit/57653dfa6d6eac2737eb2f6eca64b9ba908e565a))
* CLI entrypoint and project docs ([073dccb](https://github.com/contextbridge/patchwave-analysis/commit/073dccbd70c5d7356b5c72118bf7a498c37bb728))
* core infrastructure — Context, IO, GitHub client, analytics ([edd14ac](https://github.com/contextbridge/patchwave-analysis/commit/edd14ac49cf3326653188bfd65bd6c828c55b476))
* data collectors and dependency-bump heuristics ([2ef4ad3](https://github.com/contextbridge/patchwave-analysis/commit/2ef4ad35ec0f8f18750886a0e28417a17e948480))
* React report web UI and build script ([00dd2ec](https://github.com/contextbridge/patchwave-analysis/commit/00dd2ec77abfa72291903067ac105cf97349f18b))
* refocus the report on engineer toil and polish the UI ([#9](https://github.com/contextbridge/patchwave-analysis/issues/9)) ([ae6853f](https://github.com/contextbridge/patchwave-analysis/commit/ae6853f51063ca1d24e0af035299c5959bd7793d))
* report aggregation, cost model, bundling, and HTML render ([376adb8](https://github.com/contextbridge/patchwave-analysis/commit/376adb8f85169e23b2dfc7253bd08daf0c8a189b))
* waitlist via upload ([#12](https://github.com/contextbridge/patchwave-analysis/issues/12)) ([b2050e3](https://github.com/contextbridge/patchwave-analysis/commit/b2050e355350eb42b7fa1daee8d745da3c2f99f6))


### Bug Fixes

* allow setting numberstepper directly ([367beb8](https://github.com/contextbridge/patchwave-analysis/commit/367beb80bc90d83473c37648b52024b6ca10dc52))
* double counting reviewers and mergers ([2cfa24e](https://github.com/contextbridge/patchwave-analysis/commit/2cfa24ecb68df236bc215979a79a68064ed96e72))
* exclude bot actors from the cost table and forked repos from the analysis ([#10](https://github.com/contextbridge/patchwave-analysis/issues/10)) ([7ce42f0](https://github.com/contextbridge/patchwave-analysis/commit/7ce42f0270e853ff02ab604497a00f27829e9245))
* improved sources ([#13](https://github.com/contextbridge/patchwave-analysis/issues/13)) ([010a11a](https://github.com/contextbridge/patchwave-analysis/commit/010a11a7e1fa15eea9bc89b3edd090c5efb8dc1c))
* streamline CLI share prompts ([#11](https://github.com/contextbridge/patchwave-analysis/issues/11)) ([066465c](https://github.com/contextbridge/patchwave-analysis/commit/066465c6836ca660c37d04e3224fbcc03e3a4887))
