import { expect, test } from 'bun:test';
import { repoMeta } from '../testFactories.ts';
import { FakeGithubClient } from '../testHelpers/index.ts';
import { BATCH_SIZE, listRepoMetadataBatched } from './repoMetadata.ts';

function repoBatchResponse(nodes: unknown[]): Record<string, unknown> {
  return { nodes };
}

function repoNode(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    __typename: 'Repository',
    yml: null,
    yaml: null,
    defaultBranchRef: null,
    ...overrides,
  };
}

test('parses dependabot config from yml blob text', async () => {
  const client = new FakeGithubClient();
  client.onGraphql('RepoMetadataBatch').resolves(
    repoBatchResponse([
      repoNode({
        yml: {
          text: 'version: 2\nupdates:\n  - package-ecosystem: npm\n    directory: /\n    schedule:\n      interval: weekly\n',
        },
        yaml: null,
        defaultBranchRef: { branchProtectionRule: null, rules: { nodes: [] } },
      }),
    ]),
  );

  const repos = [repoMeta.build({ owner: 'acme', name: 'widgets' })];
  const result = await listRepoMetadataBatched(client, repos);
  expect(result.isOk()).toBe(true);
  if (result.isOk()) {
    expect(result.value.dependabotConfig[0]).toMatchObject({
      owner: 'acme',
      name: 'widgets',
      hasConfig: true,
      ecosystems: ['npm'],
    });
    expect(result.value.branchProtection[0]).toMatchObject({
      hasProtection: false,
      sources: [],
      requiredApprovingReviewCount: null,
      requiresStatusChecks: false,
    });
  }
});

test('falls back to yaml blob when yml is missing', async () => {
  const client = new FakeGithubClient();
  client.onGraphql('RepoMetadataBatch').resolves(
    repoBatchResponse([
      repoNode({
        yml: null,
        yaml: {
          text: 'version: 2\nupdates:\n  - package-ecosystem: gomod\n    directory: /\n    schedule:\n      interval: daily\n',
        },
        defaultBranchRef: null,
      }),
    ]),
  );

  const repos = [repoMeta.build({ owner: 'acme', name: 'widgets' })];
  const result = await listRepoMetadataBatched(client, repos);
  if (result.isOk()) {
    expect(result.value.dependabotConfig[0]).toMatchObject({ hasConfig: true, ecosystems: ['gomod'] });
  }
});

test('produces hasConfig=false when both blobs are null', async () => {
  const client = new FakeGithubClient();
  client.onGraphql('RepoMetadataBatch').resolves(
    repoBatchResponse([
      repoNode({
        yml: null,
        yaml: null,
        defaultBranchRef: null,
      }),
    ]),
  );

  const repos = [repoMeta.build({ owner: 'acme', name: 'widgets' })];
  const result = await listRepoMetadataBatched(client, repos);
  if (result.isOk()) {
    expect(result.value.dependabotConfig[0]).toMatchObject({ hasConfig: false, ecosystems: [], updates: [] });
  }
});

test('builds classic branch protection from branchProtectionRule', async () => {
  const client = new FakeGithubClient();
  client.onGraphql('RepoMetadataBatch').resolves(
    repoBatchResponse([
      repoNode({
        yml: null,
        yaml: null,
        defaultBranchRef: {
          branchProtectionRule: { requiredApprovingReviewCount: 2, requiresStatusChecks: true },
          rules: { nodes: [] },
        },
      }),
    ]),
  );

  const repos = [repoMeta.build({ owner: 'acme', name: 'widgets' })];
  const result = await listRepoMetadataBatched(client, repos);
  if (result.isOk()) {
    expect(result.value.branchProtection[0]).toMatchObject({
      hasProtection: true,
      sources: ['classic'],
      requiredApprovingReviewCount: 2,
      requiresStatusChecks: true,
    });
  }
});

test('builds ruleset branch protection from rules nodes', async () => {
  const client = new FakeGithubClient();
  client.onGraphql('RepoMetadataBatch').resolves(
    repoBatchResponse([
      repoNode({
        yml: null,
        yaml: null,
        defaultBranchRef: {
          branchProtectionRule: null,
          rules: {
            nodes: [
              {
                type: 'PULL_REQUEST',
                parameters: { __typename: 'PullRequestParameters', requiredApprovingReviewCount: 1 },
              },
              {
                type: 'REQUIRED_STATUS_CHECKS',
                parameters: { __typename: 'RequiredStatusChecksParameters', requiredStatusChecks: [{ context: 'ci' }] },
              },
            ],
          },
        },
      }),
    ]),
  );

  const repos = [repoMeta.build({ owner: 'acme', name: 'widgets' })];
  const result = await listRepoMetadataBatched(client, repos);
  if (result.isOk()) {
    expect(result.value.branchProtection[0]).toMatchObject({
      hasProtection: true,
      sources: ['ruleset'],
      requiredApprovingReviewCount: 1,
      requiresStatusChecks: true,
    });
  }
});

test('takes the max approving count when classic and ruleset both apply', async () => {
  const client = new FakeGithubClient();
  client.onGraphql('RepoMetadataBatch').resolves(
    repoBatchResponse([
      repoNode({
        yml: null,
        yaml: null,
        defaultBranchRef: {
          branchProtectionRule: { requiredApprovingReviewCount: 1, requiresStatusChecks: false },
          rules: {
            nodes: [
              {
                type: 'PULL_REQUEST',
                parameters: { __typename: 'PullRequestParameters', requiredApprovingReviewCount: 3 },
              },
            ],
          },
        },
      }),
    ]),
  );

  const repos = [repoMeta.build({ owner: 'acme', name: 'widgets' })];
  const result = await listRepoMetadataBatched(client, repos);
  if (result.isOk()) {
    expect(result.value.branchProtection[0]).toMatchObject({
      hasProtection: true,
      sources: ['classic', 'ruleset'],
      requiredApprovingReviewCount: 3,
      requiresStatusChecks: false,
    });
  }
});

test('chunks repos into batches of BATCH_SIZE', async () => {
  const client = new FakeGithubClient();
  client
    .onGraphql('RepoMetadataBatch')
    .resolves(repoBatchResponse(Array.from({ length: BATCH_SIZE }, () => repoNode())));

  const repos = Array.from({ length: 25 }, (_, i) =>
    repoMeta.build({ owner: 'acme', name: `repo-${i.toString()}`, nodeId: `node-${i.toString()}` }),
  );
  const result = await listRepoMetadataBatched(client, repos);
  expect(result.isOk()).toBe(true);
  expect(client.callsTo('graphql')).toHaveLength(2);
  const calls = client.callsTo('graphql');
  const first = calls[0];
  const second = calls[1];
  if (first?.kind === 'graphql') expect(first.variables.ids).toHaveLength(20);
  if (second?.kind === 'graphql')
    expect(second.variables.ids).toEqual(['node-20', 'node-21', 'node-22', 'node-23', 'node-24']);
});

test('emits a warning slice and continues when a batch GraphQL call errors', async () => {
  const client = new FakeGithubClient();
  client.onGraphql('RepoMetadataBatch').fails({ kind: 'http', status: 500, message: 'server error' });

  const repos = [repoMeta.build({ owner: 'acme', name: 'a' }), repoMeta.build({ owner: 'acme', name: 'b' })];
  const result = await listRepoMetadataBatched(client, repos);
  expect(result.isOk()).toBe(true);
  if (result.isOk()) {
    expect(result.value.dependabotConfig).toEqual([]);
    expect(result.value.branchProtection).toEqual([]);
    expect(result.value.warnings).toHaveLength(2);
    expect(result.value.warnings[0]).toMatchObject({ collector: 'repoMetadata', repo: { owner: 'acme', name: 'a' } });
  }
});

test('warns and skips null or non-repository nodes in the response', async () => {
  const client = new FakeGithubClient();
  client.onGraphql('RepoMetadataBatch').resolves(repoBatchResponse([null, { __typename: 'User' }]));

  const repos = [
    repoMeta.build({ owner: 'acme', name: 'widgets' }),
    repoMeta.build({ owner: 'acme', name: 'user-node' }),
  ];
  const result = await listRepoMetadataBatched(client, repos);
  expect(result.isOk()).toBe(true);
  if (result.isOk()) {
    expect(result.value.dependabotConfig).toEqual([]);
    expect(result.value.branchProtection).toEqual([]);
    expect(result.value.warnings).toHaveLength(2);
    expect(result.value.warnings[0]).toMatchObject({
      collector: 'repoMetadata',
      repo: { owner: 'acme', name: 'widgets' },
    });
    expect(result.value.warnings[1]).toMatchObject({
      collector: 'repoMetadata',
      repo: { owner: 'acme', name: 'user-node' },
    });
  }
});

test('treats any non-null rule node as ruleset protection (matches old REST behavior)', async () => {
  const client = new FakeGithubClient();
  client.onGraphql('RepoMetadataBatch').resolves(
    repoBatchResponse([
      repoNode({
        yml: null,
        yaml: null,
        defaultBranchRef: {
          branchProtectionRule: null,
          rules: { nodes: [{ type: 'DELETION', parameters: null }] },
        },
      }),
    ]),
  );

  const repos = [repoMeta.build({ owner: 'acme', name: 'widgets' })];
  const result = await listRepoMetadataBatched(client, repos);
  if (result.isOk()) {
    expect(result.value.branchProtection[0]).toMatchObject({
      hasProtection: true,
      sources: ['ruleset'],
      requiredApprovingReviewCount: null,
      requiresStatusChecks: false,
    });
  }
});

test('returns an empty result with no graphql calls when repos is empty', async () => {
  const client = new FakeGithubClient();

  const result = await listRepoMetadataBatched(client, []);
  expect(result.isOk()).toBe(true);
  if (result.isOk()) {
    expect(result.value.dependabotConfig).toEqual([]);
    expect(result.value.branchProtection).toEqual([]);
    expect(result.value.warnings).toEqual([]);
  }
  expect(client.callsTo('graphql')).toHaveLength(0);
});
