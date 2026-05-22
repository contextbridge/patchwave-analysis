import { describe, expect, test } from 'bun:test';
import { FakeAnalytics, FakePrompter, FakeUploader } from '../testHelpers/index.ts';
import { instantFromString } from '../time.ts';
import { type SharePromptInputs, runSharePrompt } from './sharePrompt.ts';

function makeInputs(overrides: Partial<SharePromptInputs> = {}): SharePromptInputs {
  return {
    prompter: new FakePrompter(),
    uploader: new FakeUploader(),
    analytics: new FakeAnalytics(),
    markdownPath: '/tmp/report.md',
    zipPath: '/tmp/report.zip',
    markdownContent: '# report\n',
    zipBytes: new Uint8Array([0x50, 0x4b]),
    identifier: 'anon-uuid',
    appVersion: '0.0.1',
    now: instantFromString('2026-05-22T12:00:00Z'),
    ...overrides,
  };
}

describe('runSharePrompt', () => {
  test('shows file paths and a clear share question before deciding', async () => {
    const prompter = new FakePrompter().scriptSelect('declined');
    const inputs = makeInputs({ prompter });

    await runSharePrompt(inputs);

    const reportReadyNote = prompter.notes.find((n) => n.title === 'Report ready');
    expect(reportReadyNote?.message).toContain('/tmp/report.md');
    expect(reportReadyNote?.message).toContain('/tmp/report.zip');
    expect(prompter.selects[0]?.message).toContain('share this with us');
    expect(prompter.selects[0]?.choices.map((c) => c.value)).toEqual(['declined', 'markdown', 'full']);
  });

  test("declined: doesn't upload, points to founders + patchwave.ai", async () => {
    const prompter = new FakePrompter().scriptSelect('declined');
    const uploader = new FakeUploader();
    const analytics = new FakeAnalytics();
    const inputs = makeInputs({ prompter, uploader, analytics });

    const outcome = await runSharePrompt(inputs);

    expect(outcome).toEqual({ kind: 'declined' });
    expect(uploader.calls).toHaveLength(0);
    const allSetNote = prompter.notes.find((n) => n.title === 'All set');
    expect(allSetNote?.message).toContain('founders@contextbridge.com');
    expect(allSetNote?.message).toContain('patchwave.ai');
    expect(analytics.capturedEvents('share_choice')[0]?.properties).toMatchObject({ choice: 'declined' });
  });

  test('markdown-only: uploads the raw markdown bytes with kind:markdown', async () => {
    const prompter = new FakePrompter().scriptSelect('markdown').scriptText('');
    const uploader = new FakeUploader();
    const analytics = new FakeAnalytics();
    const inputs = makeInputs({ prompter, uploader, analytics });

    const outcome = await runSharePrompt(inputs);

    expect(outcome).toMatchObject({ kind: 'shared', choice: 'markdown', identifier: 'anon-uuid' });
    expect(uploader.calls).toHaveLength(1);
    expect(uploader.calls[0]?.kind).toBe('markdown');
    expect(uploader.calls[0]?.identifier).toBe('anon-uuid');
    expect(uploader.calls[0]?.appVersion).toBe('0.0.1');
    expect(uploader.calls[0]?.timestamp).toBe('2026-05-22T12:00:00Z');
    expect(new TextDecoder().decode(uploader.calls[0]?.bytes)).toBe('# report\n');
    expect(analytics.capturedEvents('upload_succeeded')[0]?.properties).toMatchObject({ mode: 'markdown' });
  });

  test('full: uploads the original zip bytes unchanged with kind:zip', async () => {
    const prompter = new FakePrompter().scriptSelect('full').scriptText('');
    const uploader = new FakeUploader();
    const zipBytes = new Uint8Array([1, 2, 3, 4, 5]);
    const inputs = makeInputs({ prompter, uploader, zipBytes });

    await runSharePrompt(inputs);

    expect(uploader.calls[0]?.kind).toBe('zip');
    expect(uploader.calls[0]?.bytes).toEqual(zipBytes);
  });

  test('uses a volunteered email as the identifier', async () => {
    const prompter = new FakePrompter().scriptSelect('full').scriptText('ben@example.com');
    const uploader = new FakeUploader();
    const inputs = makeInputs({ prompter, uploader });

    const outcome = await runSharePrompt(inputs);

    expect(outcome).toMatchObject({ kind: 'shared', identifier: 'ben@example.com' });
    expect(uploader.calls[0]?.identifier).toBe('ben@example.com');
  });

  test('upload failure surfaces the error and leaves files in place', async () => {
    const prompter = new FakePrompter().scriptSelect('full').scriptText('');
    const uploader = new FakeUploader().fails({ kind: 'presign-bad-status', status: 500, body: 'boom' });
    const analytics = new FakeAnalytics();
    const inputs = makeInputs({ prompter, uploader, analytics });

    const outcome = await runSharePrompt(inputs);

    expect(outcome.kind).toBe('upload-failed');
    if (outcome.kind === 'upload-failed') {
      expect(outcome.choice).toBe('full');
      expect(outcome.message).toContain('500');
    }
    expect(analytics.capturedEvents('upload_failed')[0]?.properties).toMatchObject({
      mode: 'full',
      error_kind: 'presign-bad-status',
    });
    const failureNote = prompter.notes.find((n) => n.title === "We couldn't upload");
    expect(failureNote?.message).toContain('/tmp/report.md');
    expect(failureNote?.message).toContain('/tmp/report.zip');
    expect(failureNote?.message).toContain('founders@contextbridge.com');
  });

  test('user cancellation at the choice prompt is treated as declined', async () => {
    const prompter = new FakePrompter().scriptSelect({ kind: 'cancelled' });
    const uploader = new FakeUploader();
    const analytics = new FakeAnalytics();
    const inputs = makeInputs({ prompter, uploader, analytics });

    const outcome = await runSharePrompt(inputs);

    expect(outcome).toEqual({ kind: 'cancelled' });
    expect(uploader.calls).toHaveLength(0);
    expect(analytics.capturedEvents('share_choice')[0]?.properties).toMatchObject({ choice: 'cancelled' });
  });
});
