import { Factory } from 'fishery';
import type { RequestErrorLike } from './errors.ts';

// Octokit surfaces failures as an Error carrying status/request/response. Fishery
// preserves the Error prototype because the generator returns a non-plain object,
// so overrides merge onto a real Error instance.
export const requestError = Factory.define<Error & RequestErrorLike>(() => {
  const err = new Error('forbidden') as Error & RequestErrorLike;
  err.status = 403;
  err.request = { url: 'https://api.github.com/test' };
  err.response = { headers: {} };
  return err;
});
