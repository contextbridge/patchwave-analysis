import { describe, expect, test } from 'bun:test';
import { BrowserOpenerImpl } from './BrowserOpener.ts';

describe('BrowserOpenerImpl', () => {
  test('calls the injected opener with the target and resolves ok', async () => {
    const calls: string[] = [];
    const opener = new BrowserOpenerImpl({
      open: (target) => {
        calls.push(target);
        return Promise.resolve();
      },
    });

    const result = await opener.open('/tmp/report.html');

    expect(result.isOk()).toBe(true);
    expect(calls).toEqual(['/tmp/report.html']);
  });

  test('maps a rejected open into an open-failed error', async () => {
    const opener = new BrowserOpenerImpl({ open: () => Promise.reject(new Error('no browser')) });

    const result = await opener.open('/tmp/report.html');

    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr()).toMatchObject({ kind: 'open-failed', message: 'no browser' });
  });
});
