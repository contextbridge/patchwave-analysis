import { describe, expect, test } from 'bun:test';
import { type FakeContextHandle, createFakeContext } from '../testHelpers/createFakeContext.ts';
import { FakeClock } from '../testHelpers/FakeClock.ts';
import { type SharePromptInputs, runSharePrompt } from './sharePrompt.ts';

function makeHandle(): FakeContextHandle {
  return createFakeContext({
    overrides: { clock: new FakeClock('2026-05-22T12:00:00Z'), appVersion: '0.0.1' },
  });
}

function makeInputs(handle: FakeContextHandle, overrides: Partial<SharePromptInputs> = {}): SharePromptInputs {
  return {
    context: handle.ctx,
    htmlPath: '/tmp/report.html',
    zipPath: '/tmp/report.zip',
    htmlContent: '<!doctype html><html></html>',
    zipBytes: new Uint8Array([0x50, 0x4b]),
    identifier: 'anon-uuid',
    ...overrides,
  };
}

describe('runSharePrompt', () => {
  test('shows file paths and a clear share question, defaulting to sharing everything', async () => {
    const handle = makeHandle();
    handle.prompter.scriptSelect('declined');

    await runSharePrompt(makeInputs(handle));

    const reportReadyNote = handle.prompter.notes.find((n) => n.title === 'Report ready');
    expect(reportReadyNote?.message).toContain('/tmp/report.html');
    expect(reportReadyNote?.message).toContain('/tmp/report.zip');
    expect(handle.prompter.selects[0]?.message).toContain('share this with us');
    expect(handle.prompter.selects[0]?.choices.map((c) => c.value)).toEqual(['full', 'html', 'declined']);
    expect(handle.prompter.selects[0]?.initialValue).toBe('full');
  });

  test("declined: doesn't upload, points to founders + patchwave.ai", async () => {
    const handle = makeHandle();
    handle.prompter.scriptSelect('declined');

    const outcome = await runSharePrompt(makeInputs(handle));

    expect(outcome).toEqual({ kind: 'declined' });
    expect(handle.uploader.calls).toHaveLength(0);
    const allSetNote = handle.prompter.notes.find((n) => n.title === 'All set');
    expect(allSetNote?.message).toContain('founders@contextbridge.ai');
    expect(allSetNote?.message).toContain('patchwave.ai');
    expect(handle.analytics.capturedEvents('share_choice')[0]?.properties).toMatchObject({ choice: 'declined' });
  });

  test('html-only: uploads the raw html bytes with kind:html', async () => {
    const handle = makeHandle();
    handle.prompter.scriptSelect('html').scriptText('');

    const outcome = await runSharePrompt(makeInputs(handle));

    expect(outcome).toMatchObject({ kind: 'shared', choice: 'html', identifier: 'anon-uuid' });
    expect(handle.uploader.calls).toHaveLength(1);
    expect(handle.uploader.calls[0]).toMatchObject({
      kind: 'html',
      identifier: 'anon-uuid',
      appVersion: '0.0.1',
      timestamp: '2026-05-22T12:00:00Z',
    });
    expect(new TextDecoder().decode(handle.uploader.calls[0]?.bytes)).toBe('<!doctype html><html></html>');
    expect(handle.analytics.capturedEvents('upload_succeeded')[0]?.properties).toMatchObject({ mode: 'html' });
  });

  test('full: uploads the original zip bytes unchanged with kind:zip', async () => {
    const handle = makeHandle();
    handle.prompter.scriptSelect('full').scriptText('');
    const zipBytes = new Uint8Array([1, 2, 3, 4, 5]);

    await runSharePrompt(makeInputs(handle, { zipBytes }));

    expect(handle.uploader.calls[0]?.kind).toBe('zip');
    expect(handle.uploader.calls[0]?.bytes).toEqual(zipBytes);
  });

  test('uses a volunteered email as the identifier', async () => {
    const handle = makeHandle();
    handle.prompter.scriptSelect('full').scriptText('ben@example.com');

    const outcome = await runSharePrompt(makeInputs(handle));

    expect(outcome).toMatchObject({ kind: 'shared', identifier: 'ben@example.com' });
    expect(handle.uploader.calls[0]?.identifier).toBe('ben@example.com');
  });

  test('upload failure surfaces the error and leaves files in place', async () => {
    const handle = makeHandle();
    handle.prompter.scriptSelect('full').scriptText('');
    handle.uploader.fails({ kind: 'presign-bad-status', status: 500, body: 'boom' });

    const outcome = await runSharePrompt(makeInputs(handle));

    expect(outcome.kind).toBe('upload-failed');
    if (outcome.kind === 'upload-failed') {
      expect(outcome.choice).toBe('full');
      expect(outcome.message).toContain('500');
    }
    expect(handle.analytics.capturedEvents('upload_failed')[0]?.properties).toMatchObject({
      mode: 'full',
      error_kind: 'presign-bad-status',
    });
    const failureNote = handle.prompter.notes.find((n) => n.title === "We couldn't upload");
    expect(failureNote?.message).toContain('/tmp/report.html');
    expect(failureNote?.message).toContain('/tmp/report.zip');
    expect(failureNote?.message).toContain('founders@contextbridge.ai');
  });

  test('user cancellation at the choice prompt is treated as declined', async () => {
    const handle = makeHandle();
    handle.prompter.scriptSelect({ kind: 'cancelled' });

    const outcome = await runSharePrompt(makeInputs(handle));

    expect(outcome).toEqual({ kind: 'cancelled' });
    expect(handle.uploader.calls).toHaveLength(0);
    expect(handle.analytics.capturedEvents('share_choice')[0]?.properties).toMatchObject({ choice: 'cancelled' });
  });
});
