import { describe, expect, test } from 'bun:test';
import { fakeContextHandle } from '../testHelpers/testFactories.ts';
import { runSharePrompt } from './sharePrompt.ts';
import { sharePromptInputsFor } from './testFactories.ts';

describe('runSharePrompt', () => {
  test('shows the report path and a clear share question, defaulting to sharing', async () => {
    const handle = fakeContextHandle.build();
    handle.prompter.scriptSelect('declined');

    await runSharePrompt(sharePromptInputsFor(handle));

    const reportReadyNote = handle.prompter.notes.find((n) => n.title === 'Report ready');
    expect(reportReadyNote?.message).toContain('acme');
    expect(reportReadyNote?.message).toContain('/tmp/report.html');
    expect(handle.prompter.selects[0]?.message).toContain('share this with us');
    expect(handle.prompter.selects[0]?.choices.map((c) => c.value)).toEqual(['html', 'declined']);
    expect(handle.prompter.selects[0]?.initialValue).toBe('html');
  });

  test("declined: doesn't upload, points to founders + patchwave.ai", async () => {
    const handle = fakeContextHandle.build();
    handle.prompter.scriptSelect('declined');

    const outcome = await runSharePrompt(sharePromptInputsFor(handle));

    expect(outcome).toEqual({ kind: 'declined' });
    expect(handle.uploader.calls).toHaveLength(0);
    const allSetNote = handle.prompter.notes.find((n) => n.title === 'All set');
    expect(allSetNote?.message).toContain('founders@contextbridge.ai');
    expect(allSetNote?.message).toContain('patchwave.ai');
    expect(handle.analytics.capturedEvents('share_choice')[0]?.properties).toMatchObject({ choice: 'declined' });
  });

  test('html-only: uploads the raw html bytes with kind:html', async () => {
    const handle = fakeContextHandle.build();
    handle.prompter.scriptSelect('html').scriptText('');

    const outcome = await runSharePrompt(sharePromptInputsFor(handle));

    expect(outcome).toMatchObject({ kind: 'shared', identifier: 'anon-uuid' });
    expect(handle.uploader.calls).toHaveLength(1);
    expect(handle.uploader.calls[0]).toMatchObject({
      identifier: 'anon-uuid',
      appVersion: '0.0.1',
      timestamp: '2026-05-22T12:00:00Z',
    });
    expect(new TextDecoder().decode(handle.uploader.calls[0]?.bytes)).toBe('<!doctype html><html></html>');
    expect(handle.analytics.capturedEvents('upload_succeeded')).toHaveLength(1);
  });

  test('uses a volunteered email as the identifier', async () => {
    const handle = fakeContextHandle.build();
    handle.prompter.scriptSelect('html').scriptText('ben@example.com');

    const outcome = await runSharePrompt(sharePromptInputsFor(handle));

    expect(outcome).toMatchObject({ kind: 'shared', identifier: 'ben@example.com' });
    expect(handle.uploader.calls[0]?.identifier).toBe('ben@example.com');
  });

  test('upload failure surfaces the error and leaves the report in place', async () => {
    const handle = fakeContextHandle.build();
    handle.prompter.scriptSelect('html').scriptText('');
    handle.uploader.fails({ kind: 'presign-bad-status', status: 500, body: 'boom' });

    const outcome = await runSharePrompt(sharePromptInputsFor(handle));

    expect(outcome.kind).toBe('upload-failed');
    if (outcome.kind === 'upload-failed') {
      expect(outcome.message).toContain('500');
    }
    expect(handle.analytics.capturedEvents('upload_failed')[0]?.properties).toMatchObject({
      error_kind: 'presign-bad-status',
    });
    const failureNote = handle.prompter.notes.find((n) => n.title === "We couldn't upload");
    expect(failureNote?.message).toContain('/tmp/report.html');
    expect(failureNote?.message).toContain('founders@contextbridge.ai');
  });

  test('user cancellation at the choice prompt is treated as declined', async () => {
    const handle = fakeContextHandle.build();
    handle.prompter.scriptSelect({ kind: 'cancelled' });

    const outcome = await runSharePrompt(sharePromptInputsFor(handle));

    expect(outcome).toEqual({ kind: 'cancelled' });
    expect(handle.uploader.calls).toHaveLength(0);
    expect(handle.analytics.capturedEvents('share_choice')[0]?.properties).toMatchObject({ choice: 'cancelled' });
  });
});
