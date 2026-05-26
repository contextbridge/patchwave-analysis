import { ResultAsync, errAsync, okAsync } from 'neverthrow';
import { toError } from '../errors.ts';

export const DEFAULT_UPLOAD_ENDPOINT = 'https://api.patchwave.ai/v1/uploads/analysis-bundle';

export type UploadError =
  | { kind: 'presign-request-failed'; message: string }
  | { kind: 'presign-bad-status'; status: number; body: string }
  | { kind: 'presign-bad-response'; message: string }
  | { kind: 's3-put-failed'; message: string }
  | { kind: 's3-bad-status'; status: number; body: string };

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

export interface UploaderImplOptions {
  readonly endpoint?: string;
  readonly fetch?: FetchFn;
}

interface PresignResponse {
  readonly uploadId: string;
  readonly presignedUrl: string;
  readonly expiresAt: string;
}

export class UploaderImpl implements Uploader {
  readonly #endpoint: string;
  readonly #fetch: FetchFn;

  constructor(options: UploaderImplOptions = {}) {
    this.#endpoint = options.endpoint ?? DEFAULT_UPLOAD_ENDPOINT;
    this.#fetch = options.fetch ?? fetch;
  }

  upload(input: UploadInput): ResultAsync<UploadResult, UploadError> {
    return this.#requestPresign(input).andThen((presign) =>
      this.#putToS3(presign.presignedUrl, input.bytes).map(() => ({ uploadId: presign.uploadId })),
    );
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
          errAsync<void, UploadError>({ kind: 's3-bad-status', status: res.status, body: text }),
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
      return `S3 returned ${err.status}: ${err.body || '(empty body)'}`;
  }
}
