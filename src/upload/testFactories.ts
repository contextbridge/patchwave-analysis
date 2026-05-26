import { Factory } from 'fishery';
import type { UploadInput } from './Uploader.ts';

export const htmlBytes = Factory.define<Uint8Array>(() => new TextEncoder().encode('<!doctype html><html></html>'));

export const uploadInput = Factory.define<UploadInput>(() => ({
  bytes: htmlBytes.build(),
  owner: 'acme',
  email: 'ben@example.com',
  appVersion: '0.0.1',
  timestamp: '2026-05-22T12:00:00Z',
}));

export interface PresignResponseBody {
  readonly uploadId: string;
  readonly presignedUrl: string;
  readonly expiresAt: string;
}

export const presignResponseBody = Factory.define<PresignResponseBody>(() => ({
  uploadId: 'uuid-1',
  presignedUrl: 'https://s3.test/some-bucket/abc?signed=1',
  expiresAt: '2026-05-22T13:00:00Z',
}));
