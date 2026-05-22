import { ResultAsync, errAsync, okAsync } from 'neverthrow';
import type { UploadError, UploadInput, UploadResult, Uploader } from '../upload/Uploader.ts';

export class FakeUploader implements Uploader {
  readonly calls: UploadInput[] = [];
  #nextResult: { ok: true; value: UploadResult } | { ok: false; error: UploadError } = {
    ok: true,
    value: { uploadId: 'fake-upload-id' },
  };

  resolves(value: UploadResult): this {
    this.#nextResult = { ok: true, value };
    return this;
  }

  fails(error: UploadError): this {
    this.#nextResult = { ok: false, error };
    return this;
  }

  upload(input: UploadInput): ResultAsync<UploadResult, UploadError> {
    this.calls.push(input);
    const next = this.#nextResult;
    return next.ok ? okAsync<UploadResult, UploadError>(next.value) : errAsync<UploadResult, UploadError>(next.error);
  }
}
