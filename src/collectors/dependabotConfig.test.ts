import { expect, test } from 'bun:test';
import { FakeGithubClient } from '../testHelpers/index.ts';
import { getDependabotConfig } from './dependabotConfig.ts';

function base64(text: string): string {
  return Buffer.from(text, 'utf8').toString('base64');
}

test('parses ecosystems from a dependabot.yml', async () => {
  const client = new FakeGithubClient();
  client.onRequest('GET /repos/{owner}/{repo}/contents/{path}', { path: '.github/dependabot.yml' }).resolves({
    content: base64(`
version: 2
updates:
  - package-ecosystem: "npm"
    directory: "/"
    schedule:
      interval: "weekly"
  - package-ecosystem: "github-actions"
    directory: "/"
    schedule:
      interval: "daily"
      `),
    encoding: 'base64',
  });

  const result = await getDependabotConfig(client, { owner: 'acme', name: 'widgets' });
  expect(result.isOk()).toBe(true);
  if (result.isOk()) {
    expect(result.value).toMatchObject({
      hasConfig: true,
      ecosystems: ['github-actions', 'npm'],
      updates: [
        { ecosystem: 'npm', interval: 'weekly', openPullRequestsLimit: 5, groupCount: 0, ignoreCount: 0 },
        { ecosystem: 'github-actions', interval: 'daily', openPullRequestsLimit: 5, groupCount: 0, ignoreCount: 0 },
      ],
    });
  }
});

test('captures open-pull-requests-limit, groups, and ignore counts per entry', async () => {
  const client = new FakeGithubClient();
  client.onRequest('GET /repos/{owner}/{repo}/contents/{path}', { path: '.github/dependabot.yml' }).resolves({
    content: base64(`
version: 2
updates:
  - package-ecosystem: npm
    directory: /
    schedule:
      interval: monthly
    open-pull-requests-limit: 20
    groups:
      eslint:
        patterns:
          - "eslint*"
      react:
        patterns:
          - "react*"
          - "react-dom"
    ignore:
      - dependency-name: "lodash"
      - dependency-name: "express"
        versions: ["4.x"]
      - dependency-name: "react"
`),
    encoding: 'base64',
  });

  const result = await getDependabotConfig(client, { owner: 'acme', name: 'widgets' });
  expect(result.isOk()).toBe(true);
  if (result.isOk()) {
    expect(result.value.updates).toEqual([
      {
        ecosystem: 'npm',
        interval: 'monthly',
        openPullRequestsLimit: 20,
        groupCount: 2,
        ignoreCount: 3,
      },
    ]);
  }
});

test('defaults openPullRequestsLimit to 5 when not specified', async () => {
  const client = new FakeGithubClient();
  client.onRequest('GET /repos/{owner}/{repo}/contents/{path}', { path: '.github/dependabot.yml' }).resolves({
    content: base64(`updates:\n  - package-ecosystem: bundler\n    schedule:\n      interval: weekly\n`),
    encoding: 'base64',
  });

  const result = await getDependabotConfig(client, { owner: 'acme', name: 'widgets' });
  expect(result.isOk()).toBe(true);
  if (result.isOk()) expect(result.value.updates[0]?.openPullRequestsLimit).toBe(5);
});

test('falls back to dependabot.yaml when .yml is absent', async () => {
  const client = new FakeGithubClient();
  client
    .onRequest('GET /repos/{owner}/{repo}/contents/{path}', { path: '.github/dependabot.yml' })
    .fails({ kind: 'not-found', message: 'no .yml' });
  client.onRequest('GET /repos/{owner}/{repo}/contents/{path}', { path: '.github/dependabot.yaml' }).resolves({
    content: base64(`updates:\n  - package-ecosystem: bundler\n`),
    encoding: 'base64',
  });

  const result = await getDependabotConfig(client, { owner: 'acme', name: 'widgets' });
  expect(result.isOk()).toBe(true);
  if (result.isOk()) {
    expect(result.value).toMatchObject({
      hasConfig: true,
      ecosystems: ['bundler'],
    });
  }
});

test('returns hasConfig: false when both paths 404 but the call still succeeds', async () => {
  const client = new FakeGithubClient();
  for (const path of ['.github/dependabot.yml', '.github/dependabot.yaml']) {
    client
      .onRequest('GET /repos/{owner}/{repo}/contents/{path}', { path })
      .fails({ kind: 'not-found', message: 'no config' });
  }

  const result = await getDependabotConfig(client, { owner: 'acme', name: 'widgets' });
  expect(result.isOk()).toBe(true);
  if (result.isOk()) {
    expect(result.value).toMatchObject({
      hasConfig: false,
      ecosystems: [],
      updates: [],
    });
  }
});

test('returns an empty updates list when the YAML is malformed', async () => {
  const client = new FakeGithubClient();
  client.onRequest('GET /repos/{owner}/{repo}/contents/{path}', { path: '.github/dependabot.yml' }).resolves({
    content: base64('this: : is\n: not valid: yaml: [\n'),
    encoding: 'base64',
  });

  const result = await getDependabotConfig(client, { owner: 'acme', name: 'widgets' });
  expect(result.isOk()).toBe(true);
  if (result.isOk()) {
    expect(result.value).toMatchObject({
      hasConfig: true,
      ecosystems: [],
      updates: [],
    });
  }
});

test('propagates non-404 errors when fetching the config', async () => {
  const client = new FakeGithubClient();
  client
    .onRequest('GET /repos/{owner}/{repo}/contents/{path}', { path: '.github/dependabot.yml' })
    .fails({ kind: 'forbidden', message: 'no access' });

  const result = await getDependabotConfig(client, { owner: 'acme', name: 'widgets' });
  expect(result.isErr()).toBe(true);
  if (result.isErr()) expect(result.error).toMatchObject({ kind: 'forbidden' });
});
