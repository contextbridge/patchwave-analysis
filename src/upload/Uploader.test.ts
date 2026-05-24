import { describe, expect, test } from 'bun:test';
import { type BundleKind, type FetchFn, UploaderImpl } from './Uploader.ts';

const ENDPOINT = 'https://api.test/v1/uploads/analysis-bundle';
const PRESIGNED_URL = 'https://s3.test/some-bucket/abc?signed=1';
const ZIP_BYTES = new Uint8Array([0x50, 0x4b, 0x03, 0x04]);
const HTML_BYTES = new TextEncoder().encode('<!doctype html><html></html>');

interface FetchCall {
  readonly url: string;
  readonly init: RequestInit | undefined;
}

function recordFetch(responses: Response[]): { fetch: FetchFn; calls: FetchCall[] } {
  const calls: FetchCall[] = [];
  const queue = [...responses];
  const fetchFn: FetchFn = (url, init) => {
    calls.push({ url, init });
    const next = queue.shift();
    if (!next) throw new Error('no more responses');
    return Promise.resolve(next);
  };
  return { fetch: fetchFn, calls };
}

function makeInput(kind: BundleKind = 'zip', bytes: Uint8Array = ZIP_BYTES) {
  return {
    bytes,
    kind,
    identifier: 'ben@example.com',
    appVersion: '0.0.1',
    timestamp: '2026-05-22T12:00:00Z',
  };
}

function presignResponse() {
  return new Response(
    JSON.stringify({
      uploadId: 'uuid-1',
      presignedUrl: PRESIGNED_URL,
      expiresAt: '2026-05-22T13:00:00Z',
    }),
    { status: 200 },
  );
}

describe('UploaderImpl', () => {
  test("zip kind: posts kind:'zip' and PUTs with application/zip", async () => {
    const { fetch, calls } = recordFetch([presignResponse(), new Response('', { status: 200 })]);

    const result = await new UploaderImpl({ endpoint: ENDPOINT, fetch }).upload(makeInput('zip', ZIP_BYTES));

    expect(result.isOk()).toBe(true);
    expect(result.unwrapOr(null)).toEqual({ uploadId: 'uuid-1' });

    expect(calls[0]?.url).toBe(ENDPOINT);
    expect(calls[0]?.init?.method).toBe('POST');
    const postBody = JSON.parse(calls[0]?.init?.body as string) as Record<string, unknown>;
    expect(postBody).toMatchObject({
      identifier: 'ben@example.com',
      appVersion: '0.0.1',
      timestamp: '2026-05-22T12:00:00Z',
      kind: 'zip',
      sizeBytes: ZIP_BYTES.byteLength,
    });
    expect(postBody).not.toHaveProperty('contentType');

    expect(calls[1]?.url).toBe(PRESIGNED_URL);
    expect(calls[1]?.init?.method).toBe('PUT');
    expect(calls[1]?.init?.body).toBe(ZIP_BYTES);
    expect((calls[1]?.init?.headers as Record<string, string>)['content-type']).toBe('application/zip');
  });

  test("html kind: posts kind:'html' and PUTs raw bytes with text/html", async () => {
    const { fetch, calls } = recordFetch([presignResponse(), new Response('', { status: 200 })]);

    const result = await new UploaderImpl({ endpoint: ENDPOINT, fetch }).upload(makeInput('html', HTML_BYTES));

    expect(result.isOk()).toBe(true);
    const postBody = JSON.parse(calls[0]?.init?.body as string) as Record<string, unknown>;
    expect(postBody).toMatchObject({ kind: 'html', sizeBytes: HTML_BYTES.byteLength });
    expect(calls[1]?.init?.body).toBe(HTML_BYTES);
    expect((calls[1]?.init?.headers as Record<string, string>)['content-type']).toBe('text/html');
  });

  test('presign returns non-2xx → presign-bad-status', async () => {
    const { fetch } = recordFetch([new Response('rate limited', { status: 429 })]);
    const result = await new UploaderImpl({ endpoint: ENDPOINT, fetch }).upload(makeInput());

    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr()).toEqual({
      kind: 'presign-bad-status',
      status: 429,
      body: 'rate limited',
    });
  });

  test('presign returns malformed JSON → presign-bad-response', async () => {
    const { fetch } = recordFetch([new Response('{not json', { status: 200 })]);
    const result = await new UploaderImpl({ endpoint: ENDPOINT, fetch }).upload(makeInput());

    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr().kind).toBe('presign-bad-response');
  });

  test('presign returns JSON missing required fields → presign-bad-response', async () => {
    const { fetch } = recordFetch([new Response(JSON.stringify({ uploadId: 'x' }), { status: 200 })]);
    const result = await new UploaderImpl({ endpoint: ENDPOINT, fetch }).upload(makeInput());

    expect(result.isErr()).toBe(true);
    const err = result._unsafeUnwrapErr();
    expect(err.kind).toBe('presign-bad-response');
    if (err.kind === 'presign-bad-response') {
      expect(err.message).toContain('presignedUrl');
    }
  });

  test('S3 PUT returns non-2xx → s3-bad-status', async () => {
    const { fetch } = recordFetch([presignResponse(), new Response('access denied', { status: 403 })]);
    const result = await new UploaderImpl({ endpoint: ENDPOINT, fetch }).upload(makeInput());

    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr()).toEqual({
      kind: 's3-bad-status',
      status: 403,
      body: 'access denied',
    });
  });

  test('network failure during presign → presign-request-failed', async () => {
    const fetchFn: FetchFn = () => Promise.reject(new Error('econnreset'));
    const result = await new UploaderImpl({ endpoint: ENDPOINT, fetch: fetchFn }).upload(makeInput());

    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr()).toEqual({
      kind: 'presign-request-failed',
      message: 'econnreset',
    });
  });
});
