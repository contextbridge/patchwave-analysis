import { ResultAsync, errAsync, okAsync } from 'neverthrow';
import type { BrowserOpenError, BrowserOpener } from '../BrowserOpener.ts';

export class FakeBrowserOpener implements BrowserOpener {
  readonly opened: string[] = [];
  #nextResult: { ok: true } | { ok: false; error: BrowserOpenError } = { ok: true };

  fails(error: BrowserOpenError): this {
    this.#nextResult = { ok: false, error };
    return this;
  }

  open(target: string): ResultAsync<void, BrowserOpenError> {
    this.opened.push(target);
    const next = this.#nextResult;
    return next.ok ? okAsync<void, BrowserOpenError>(undefined) : errAsync<void, BrowserOpenError>(next.error);
  }
}
