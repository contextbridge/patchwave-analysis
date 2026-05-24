import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, expect, test } from 'bun:test';
import { getOrCreateAnonymousId } from './anonymousId.ts';

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'patchwave-anonid-'));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

test('creates a new UUID when the file is missing and persists it', () => {
  const id = getOrCreateAnonymousId({ XDG_CONFIG_HOME: dir });
  expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);

  const persisted = readFileSync(join(dir, 'contextbridge', 'anonymous_id'), 'utf8').trim();
  expect(persisted).toBe(id);
});

test('returns the existing id on subsequent calls', () => {
  const first = getOrCreateAnonymousId({ XDG_CONFIG_HOME: dir });
  const second = getOrCreateAnonymousId({ XDG_CONFIG_HOME: dir });
  expect(second).toBe(first);
});

test('falls back to $HOME/.config when XDG_CONFIG_HOME is unset', () => {
  const id = getOrCreateAnonymousId({ HOME: dir });
  expect(id.length).toBeGreaterThan(0);
  const persisted = readFileSync(join(dir, '.config', 'contextbridge', 'anonymous_id'), 'utf8').trim();
  expect(persisted).toBe(id);
});

test('reads a pre-existing id file written by another tool', async () => {
  await Bun.write(join(dir, 'contextbridge', 'anonymous_id'), 'preexisting-id\n');
  const id = getOrCreateAnonymousId({ XDG_CONFIG_HOME: dir });
  expect(id).toBe('preexisting-id');
});
