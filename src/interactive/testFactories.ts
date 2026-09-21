import { Factory } from 'fishery';
import type { AuthError } from '../github/auth.ts';

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
