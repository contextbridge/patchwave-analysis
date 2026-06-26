import { describe, expect, test } from 'bun:test';
import { htmlBytes, presignResponseBody, uploadInput } from './testFactories.ts';
import { type FetchFn, UploaderImpl } from './Uploader.ts';

const ENDPOINT = 'https://api.test/v1/uploads/analysis-bundle';

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

function presignResponse() {
  return new Response(JSON.stringify(presignResponseBody.build()), { status: 200 });
}

describe('UploaderImpl', () => {
  test('posts owner/email metadata and PUTs raw html bytes with text/html', async () => {
    const { fetch, calls } = recordFetch([presignResponse(), new Response('', { status: 200 })]);
    const bytes = htmlBytes.build();

    const result = await new UploaderImpl({ endpoint: ENDPOINT, fetch }).upload(uploadInput.build({ bytes }));

    expect(result.isOk()).toBe(true);
    expect(result.unwrapOr(null)).toEqual({ uploadId: 'uuid-1' });

    expect(calls[0]?.url).toBe(ENDPOINT);
    expect(calls[0]?.init?.method).toBe('POST');
    const postBody = JSON.parse(calls[0]?.init?.body as string) as Record<string, unknown>;
    expect(postBody).toMatchObject({
      owner: 'acme',
      email: 'ben@example.com',
      appVersion: '0.0.1',
      timestamp: '2026-05-22T12:00:00Z',
      sizeBytes: bytes.byteLength,
    });

    expect(calls[1]?.url).toBe(presignResponseBody.build().presignedUrl);
    expect(calls[1]?.init?.method).toBe('PUT');
    expect(calls[1]?.init?.body).toBe(bytes as BodyInit);
    expect((calls[1]?.init?.headers as Record<string, string>)['content-type']).toBe('text/html');
  });

  test('presign returns non-2xx → presign-bad-status', async () => {
    const { fetch } = recordFetch([new Response('rate limited', { status: 429 })]);
    const result = await new UploaderImpl({ endpoint: ENDPOINT, fetch }).upload(uploadInput.build());

    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr()).toEqual({
      kind: 'presign-bad-status',
      status: 429,
      body: 'rate limited',
    });
  });

  test('presign returns malformed JSON → presign-bad-response', async () => {
    const { fetch } = recordFetch([new Response('{not json', { status: 200 })]);
    const result = await new UploaderImpl({ endpoint: ENDPOINT, fetch }).upload(uploadInput.build());

    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr().kind).toBe('presign-bad-response');
  });

  test('presign returns JSON missing required fields → presign-bad-response', async () => {
    const { fetch } = recordFetch([new Response(JSON.stringify({ uploadId: 'x' }), { status: 200 })]);
    const result = await new UploaderImpl({ endpoint: ENDPOINT, fetch }).upload(uploadInput.build());

    expect(result.isErr()).toBe(true);
    const err = result._unsafeUnwrapErr();
    expect(err.kind).toBe('presign-bad-response');
    if (err.kind === 'presign-bad-response') {
      expect(err.message).toContain('presignedUrl');
    }
  });

  test('S3 PUT returns non-2xx → s3-bad-status', async () => {
    const { fetch } = recordFetch([presignResponse(), new Response('access denied', { status: 403 })]);
    const result = await new UploaderImpl({ endpoint: ENDPOINT, fetch }).upload(uploadInput.build());

    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr()).toEqual({
      kind: 's3-bad-status',
      status: 403,
      body: 'access denied',
    });
  });

  test('S3 PUT XML error → parses s3Code and requestId', async () => {
    const xml =
      '<?xml version="1.0" encoding="UTF-8"?><Error><Code>AccessDenied</Code>' +
      '<Message>Access Denied</Message><RequestId>ABC123XYZ</RequestId>' +
      '<HostId>hostid==</HostId></Error>';
    const { fetch } = recordFetch([presignResponse(), new Response(xml, { status: 403 })]);
    const result = await new UploaderImpl({ endpoint: ENDPOINT, fetch }).upload(uploadInput.build());

    expect(result.isErr()).toBe(true);
    const err = result._unsafeUnwrapErr();
    expect(err).toMatchObject({ kind: 's3-bad-status', status: 403, s3Code: 'AccessDenied', requestId: 'ABC123XYZ' });
  });

  test('retries a transient S3 5xx, then succeeds', async () => {
    const { fetch, calls } = recordFetch([
      presignResponse(),
      new Response('<Error><Code>SlowDown</Code></Error>', { status: 503 }),
      new Response('', { status: 200 }),
    ]);
    const result = await new UploaderImpl({ endpoint: ENDPOINT, fetch, retryMinTimeoutMs: 0 }).upload(
      uploadInput.build(),
    );

    expect(result.isOk()).toBe(true);
    expect(calls.length).toBe(3); // presign + 2 PUT attempts
  });

  test('retries a network failure during PUT, then succeeds', async () => {
    const responses = [presignResponse(), 'throw' as const, new Response('', { status: 200 })];
    let calls = 0;
    const fetchFn: FetchFn = () => {
      const next = responses[calls++];
      if (next === 'throw') return Promise.reject(new Error('econnreset'));
      return Promise.resolve(next as Response);
    };
    const result = await new UploaderImpl({ endpoint: ENDPOINT, fetch: fetchFn, retryMinTimeoutMs: 0 }).upload(
      uploadInput.build(),
    );

    expect(result.isOk()).toBe(true);
    expect(calls).toBe(3); // presign + failed PUT + retried PUT
  });

  test('does not retry a non-transient 403 from S3', async () => {
    const { fetch, calls } = recordFetch([presignResponse(), new Response('access denied', { status: 403 })]);
    const result = await new UploaderImpl({ endpoint: ENDPOINT, fetch, retryMinTimeoutMs: 0 }).upload(
      uploadInput.build(),
    );

    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr().kind).toBe('s3-bad-status');
    expect(calls.length).toBe(2); // presign + single PUT, no retry
  });

  test('exhausts attempts on a persistent transient failure', async () => {
    const { fetch, calls } = recordFetch([
      presignResponse(),
      new Response('<Error><Code>InternalError</Code></Error>', { status: 500 }),
      new Response('<Error><Code>InternalError</Code></Error>', { status: 500 }),
    ]);
    const result = await new UploaderImpl({
      endpoint: ENDPOINT,
      fetch,
      maxAttempts: 2,
      retryMinTimeoutMs: 0,
    }).upload(uploadInput.build());

    expect(result.isErr()).toBe(true);
    const err = result._unsafeUnwrapErr();
    expect(err).toMatchObject({ kind: 's3-bad-status', status: 500, s3Code: 'InternalError' });
    expect(calls.length).toBe(3); // presign + 2 PUT attempts
  });

  test('network failure during presign → presign-request-failed', async () => {
    const fetchFn: FetchFn = () => Promise.reject(new Error('econnreset'));
    const result = await new UploaderImpl({ endpoint: ENDPOINT, fetch: fetchFn }).upload(uploadInput.build());

    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr()).toEqual({
      kind: 'presign-request-failed',
      message: 'econnreset',
    });
  });
});
