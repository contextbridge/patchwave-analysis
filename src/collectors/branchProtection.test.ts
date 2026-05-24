import { expect, test } from 'bun:test';
import { FakeGithubClient } from '../testHelpers/index.ts';
import { getBranchProtection } from './branchProtection.ts';

const CLASSIC = 'GET /repos/{owner}/{repo}/branches/{branch}/protection';
const RULES = 'GET /repos/{owner}/{repo}/rules/branches/{branch}';

test('builds a classic-only slice when rulesets return an empty list', async () => {
  const client = new FakeGithubClient();
  client.onRequest(CLASSIC, { branch: 'main' }).resolves({
    required_pull_request_reviews: { required_approving_review_count: 2 },
    required_status_checks: { contexts: ['test'] },
  });
  client.onRequest(RULES, { branch: 'main' }).resolves([]);

  const result = await getBranchProtection(client, { owner: 'acme', name: 'widgets' }, 'main');
  expect(result.isOk()).toBe(true);
  if (result.isOk()) {
    expect(result.value).toMatchObject({
      hasProtection: true,
      sources: ['classic'],
      requiredApprovingReviewCount: 2,
      requiresStatusChecks: true,
    });
  }
});

test('builds a ruleset-only slice when classic 404s but rulesets are active', async () => {
  const client = new FakeGithubClient();
  client.onRequest(CLASSIC, { branch: 'main' }).fails({ kind: 'not-found', message: 'no classic' });
  client
    .onRequest(RULES, { branch: 'main' })
    .resolves([
      { type: 'pull_request', parameters: { required_approving_review_count: 1 } },
      { type: 'required_status_checks', parameters: {} },
      { type: 'deletion' },
    ]);

  const result = await getBranchProtection(client, { owner: 'acme', name: 'widgets' }, 'main');
  expect(result.isOk()).toBe(true);
  if (result.isOk()) {
    expect(result.value).toMatchObject({
      hasProtection: true,
      sources: ['ruleset'],
      requiredApprovingReviewCount: 1,
      requiresStatusChecks: true,
    });
  }
});

test('merges classic + ruleset, taking the strictest review count and OR-ing status checks', async () => {
  const client = new FakeGithubClient();
  client.onRequest(CLASSIC, { branch: 'main' }).resolves({
    required_pull_request_reviews: { required_approving_review_count: 1 },
    required_status_checks: null,
  });
  client.onRequest(RULES, { branch: 'main' }).resolves([
    { type: 'pull_request', parameters: { required_approving_review_count: 2 } },
    { type: 'required_status_checks', parameters: {} },
  ]);

  const result = await getBranchProtection(client, { owner: 'acme', name: 'widgets' }, 'main');
  expect(result.isOk()).toBe(true);
  if (result.isOk()) {
    expect(result.value).toMatchObject({
      hasProtection: true,
      sources: ['classic', 'ruleset'],
      requiredApprovingReviewCount: 2,
      requiresStatusChecks: true,
    });
  }
});

test('returns hasProtection: false when both classic and rulesets are absent', async () => {
  const client = new FakeGithubClient();
  client.onRequest(CLASSIC, {}).fails({ kind: 'not-found', message: 'no classic' });
  client.onRequest(RULES, {}).resolves([]);

  const result = await getBranchProtection(client, { owner: 'acme', name: 'widgets' }, 'main');
  expect(result.isOk()).toBe(true);
  if (result.isOk()) {
    expect(result.value).toMatchObject({
      hasProtection: false,
      sources: [],
      requiredApprovingReviewCount: null,
      requiresStatusChecks: false,
    });
  }
});

test('treats a 404 on the rules-for-branch endpoint as no rulesets', async () => {
  const client = new FakeGithubClient();
  client.onRequest(CLASSIC, {}).fails({ kind: 'not-found', message: 'no classic' });
  client.onRequest(RULES, {}).fails({ kind: 'not-found', message: 'no rules' });

  const result = await getBranchProtection(client, { owner: 'acme', name: 'widgets' }, 'main');
  expect(result.isOk()).toBe(true);
  if (result.isOk()) expect(result.value).toMatchObject({ hasProtection: false, sources: [] });
});

test('propagates non-404 classic errors so the partial-failure boundary can log it', async () => {
  const client = new FakeGithubClient();
  client.onRequest(CLASSIC, {}).fails({ kind: 'http', status: 500, message: 'boom' });
  client.onRequest(RULES, {}).resolves([]);

  const result = await getBranchProtection(client, { owner: 'acme', name: 'widgets' }, 'main');
  expect(result.isErr()).toBe(true);
  if (result.isErr()) expect(result.error).toMatchObject({ kind: 'http', status: 500 });
});

test('propagates non-404 ruleset errors so the partial-failure boundary can log it', async () => {
  const client = new FakeGithubClient();
  client.onRequest(CLASSIC, {}).fails({ kind: 'not-found', message: 'no classic' });
  client.onRequest(RULES, {}).fails({ kind: 'http', status: 500, message: 'boom' });

  const result = await getBranchProtection(client, { owner: 'acme', name: 'widgets' }, 'main');
  expect(result.isErr()).toBe(true);
  if (result.isErr()) expect(result.error).toMatchObject({ kind: 'http', status: 500 });
});
