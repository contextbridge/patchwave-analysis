import { ResultAsync, errAsync, okAsync } from 'neverthrow';
import { toError } from '../errors.ts';

const DEFAULT_UPLOAD_ENDPOINT = 'https://api.patchwave.ai/v1/uploads/analysis-bundle';

export type UploadError =
  | { kind: 'presign-request-failed'; message: string }
  | { kind: 'presign-bad-status'; status: number; body: string }
  | { kind: 'presign-bad-response'; message: string }
  | { kind: 's3-put-failed'; message: string }
  | { kind: 's3-bad-status'; status: number; body: string; s3Code?: string; requestId?: string };

export interface UploadInput {
  readonly bytes: Uint8Array;
  readonly owner: string;
  readonly email: string;
  readonly appVersion: string;
  readonly timestamp: string;
}

export interface UploadResult {
  readonly uploadId: string;
}

export interface Uploader {
  upload(input: UploadInput): ResultAsync<UploadResult, UploadError>;
}

export type FetchFn = (url: string, init?: RequestInit) => Promise<Response>;

interface UploaderImplOptions {
  readonly endpoint?: string;
  readonly fetch?: FetchFn;
  readonly maxAttempts?: number;
  readonly retryMinTimeoutMs?: number;
}

interface PresignResponse {
  readonly uploadId: string;
  readonly presignedUrl: string;
  readonly expiresAt: string;
}

export class UploaderImpl implements Uploader {
  readonly #endpoint: string;
  readonly #fetch: FetchFn;
  readonly #maxAttempts: number;
  readonly #retryMinTimeoutMs: number;

  constructor(options: UploaderImplOptions = {}) {
    this.#endpoint = options.endpoint ?? DEFAULT_UPLOAD_ENDPOINT;
    this.#fetch = options.fetch ?? fetch;
    this.#maxAttempts = options.maxAttempts ?? 4;
    this.#retryMinTimeoutMs = options.retryMinTimeoutMs ?? 500;
  }

  upload(input: UploadInput): ResultAsync<UploadResult, UploadError> {
    return this.#requestPresign(input).andThen((presign) =>
      this.#putToS3WithRetry(presign.presignedUrl, input.bytes).map(() => ({ uploadId: presign.uploadId })),
    );
  }

  // The bytes are buffered in memory, so the PUT is safely replayable. Retry only
  // the transient S3 outcomes (RequestTimeout/SlowDown/5xx, network errors) —
  // see isRetryableUploadError; 4xx signature/permission failures fail fast.
  // Backoff is exponential from retryMinTimeoutMs; attempts cap at maxAttempts.
  #putToS3WithRetry(url: string, bytes: Uint8Array, attempt = 1): ResultAsync<void, UploadError> {
    return this.#putToS3(url, bytes).orElse((err) => {
      if (attempt >= this.#maxAttempts || !isRetryableUploadError(err)) {
        return errAsync<void, UploadError>(err);
      }
      return delay(this.#retryMinTimeoutMs * 2 ** (attempt - 1)).andThen(() =>
        this.#putToS3WithRetry(url, bytes, attempt + 1),
      );
    });
  }

  #requestPresign(input: UploadInput): ResultAsync<PresignResponse, UploadError> {
    const body = JSON.stringify({
      owner: input.owner,
      email: input.email,
      appVersion: input.appVersion,
      timestamp: input.timestamp,
      sizeBytes: input.bytes.byteLength,
    });
    return ResultAsync.fromPromise(
      this.#fetch(this.#endpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body,
      }),
      (e): UploadError => ({ kind: 'presign-request-failed', message: toError(e).message }),
    ).andThen((res) => {
      if (!res.ok) {
        return ResultAsync.fromSafePromise(res.text().catch(() => '')).andThen((text) =>
          errAsync<PresignResponse, UploadError>({ kind: 'presign-bad-status', status: res.status, body: text }),
        );
      }
      return ResultAsync.fromPromise(
        res.json(),
        (e): UploadError => ({ kind: 'presign-bad-response', message: toError(e).message }),
      ).andThen(parsePresign);
    });
  }

  #putToS3(url: string, bytes: Uint8Array): ResultAsync<void, UploadError> {
    return ResultAsync.fromPromise(
      this.#fetch(url, {
        method: 'PUT',
        headers: { 'content-type': 'text/html' },
        // The DOM lib's `BodyInit` narrows `BufferSource` to `Uint8Array<ArrayBuffer>`,
        // but our bytes are `Uint8Array<ArrayBufferLike>`. fetch accepts them at runtime.
        body: bytes as BodyInit,
      }),
      (e): UploadError => ({ kind: 's3-put-failed', message: toError(e).message }),
    ).andThen((res) => {
      if (!res.ok) {
        return ResultAsync.fromSafePromise(res.text().catch(() => '')).andThen((text) =>
          errAsync<void, UploadError>({ kind: 's3-bad-status', status: res.status, body: text, ...parseS3Error(text) }),
        );
      }
      return okAsync<void, UploadError>(undefined);
    });
  }
}

function parsePresign(value: unknown): ResultAsync<PresignResponse, UploadError> {
  if (!isObject(value)) {
    return errAsync<PresignResponse, UploadError>({
      kind: 'presign-bad-response',
      message: 'response was not a JSON object',
    });
  }
  const uploadId = value['uploadId'];
  const presignedUrl = value['presignedUrl'];
  const expiresAt = value['expiresAt'];
  if (typeof uploadId !== 'string' || typeof presignedUrl !== 'string' || typeof expiresAt !== 'string') {
    return errAsync<PresignResponse, UploadError>({
      kind: 'presign-bad-response',
      message: 'response missing uploadId/presignedUrl/expiresAt',
    });
  }
  return okAsync<PresignResponse, UploadError>({ uploadId, presignedUrl, expiresAt });
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

const delay = (ms: number): ResultAsync<void, never> =>
  ResultAsync.fromSafePromise(new Promise<void>((resolve) => setTimeout(resolve, ms)));

function isRetryableUploadError(err: UploadError): boolean {
  switch (err.kind) {
    case 's3-put-failed':
      return true;
    case 's3-bad-status':
      return err.status === 429 || err.status >= 500 || err.s3Code === 'RequestTimeout';
    default:
      return false;
  }
}

// S3 errors are XML; we pull the machine-readable <Code> and <RequestId> (cause + AWS
// support handle) but drop the body, which echoes the owner/email object key.
function parseS3Error(body: string): { s3Code?: string; requestId?: string } {
  const s3Code = body.match(/<Code>([^<]+)<\/Code>/)?.[1];
  const requestId = body.match(/<RequestId>([^<]+)<\/RequestId>/)?.[1];
  return { ...(s3Code ? { s3Code } : {}), ...(requestId ? { requestId } : {}) };
}

// Privacy-safe telemetry: omits the raw S3 body and presigned URL (both embed the
// owner/email object key). Network error messages are safe to include.
export function uploadErrorTelemetry(err: UploadError): Record<string, string | number> {
  switch (err.kind) {
    case 'presign-request-failed':
    case 'presign-bad-response':
    case 's3-put-failed':
      return { error_kind: err.kind, error_message: err.message.slice(0, 300) };
    case 'presign-bad-status':
      return { error_kind: err.kind, status: err.status };
    case 's3-bad-status':
      return {
        error_kind: err.kind,
        status: err.status,
        ...(err.s3Code ? { s3_code: err.s3Code } : {}),
        ...(err.requestId ? { request_id: err.requestId } : {}),
      };
  }
}

export function formatUploadError(err: UploadError): string {
  switch (err.kind) {
    case 'presign-request-failed':
      return `failed to reach upload service: ${err.message}`;
    case 'presign-bad-status':
      return `upload service returned ${err.status}: ${err.body || '(empty body)'}`;
    case 'presign-bad-response':
      return `upload service returned an unexpected response: ${err.message}`;
    case 's3-put-failed':
      return `failed to upload to S3: ${err.message}`;
    case 's3-bad-status':
      return `S3 returned ${err.status}${err.s3Code ? ` (${err.s3Code})` : ''}: ${err.body || '(empty body)'}`;
  }
}
