import { ResultAsync } from 'neverthrow';
import open from 'open';
import { toError } from './errors.ts';

export type BrowserOpenError = { kind: 'open-failed'; message: string };

export interface BrowserOpener {
  open(target: string): ResultAsync<void, BrowserOpenError>;
}

export type OpenFn = (target: string) => Promise<unknown>;

export interface BrowserOpenerImplOptions {
  readonly open?: OpenFn;
}

export class BrowserOpenerImpl implements BrowserOpener {
  readonly #open: OpenFn;

  constructor(options: BrowserOpenerImplOptions = {}) {
    this.#open = options.open ?? open;
  }

  open(target: string): ResultAsync<void, BrowserOpenError> {
    return ResultAsync.fromPromise(
      this.#open(target).then(() => undefined),
      (e): BrowserOpenError => ({ kind: 'open-failed', message: toError(e).message }),
    );
  }
}

export function formatBrowserOpenError(err: BrowserOpenError): string {
  return `couldn't open your browser: ${err.message}`;
}
