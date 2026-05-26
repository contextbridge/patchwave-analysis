import { Factory } from 'fishery';
import type { AuthError } from '../github/auth.ts';
import type { FakeContextHandle } from '../testHelpers/createFakeContext.ts';
import { fakeContextHandle } from '../testHelpers/testFactories.ts';
import type { SharePromptInputs } from './sharePrompt.ts';

export const sharePromptInputs = Factory.define<SharePromptInputs>(() => {
  const handle = fakeContextHandle.build();
  return {
    context: handle.ctx,
    target: 'acme',
    htmlPath: '/tmp/report.html',
    htmlContent: '<!doctype html><html></html>',
  };
});

export const sharePromptInputsFor = (
  handle: FakeContextHandle,
  overrides: Partial<SharePromptInputs> = {},
): SharePromptInputs => sharePromptInputs.build({ context: handle.ctx, ...overrides });

export const githubViewer = Factory.define<{ login: string }>(() => ({
  login: 'ben',
}));

export const githubOrg = Factory.define<{ login: string }>(() => ({
  login: 'acme',
}));

export const noTokenAuthError = Factory.define<AuthError>(() => ({
  kind: 'no-token',
  message: 'no token',
}));
