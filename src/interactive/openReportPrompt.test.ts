import { describe, expect, test } from 'bun:test';
import { createFakeContext } from '../testHelpers/createFakeContext.ts';
import { runOpenReportPrompt } from './openReportPrompt.ts';

describe('runOpenReportPrompt', () => {
  test('defaults the confirm to yes', async () => {
    const handle = createFakeContext();
    handle.prompter.scriptConfirm(true);

    await runOpenReportPrompt({ context: handle.ctx, htmlPath: '/tmp/report.html' });

    expect(handle.prompter.confirms[0]?.defaultValue).toBe(true);
  });

  test('opens the report in the browser when confirmed', async () => {
    const handle = createFakeContext();
    handle.prompter.scriptConfirm(true);

    await runOpenReportPrompt({ context: handle.ctx, htmlPath: '/tmp/report.html' });

    expect(handle.browserOpener.opened).toEqual(['/tmp/report.html']);
    expect(handle.analytics.capturedEvents('report_open_choice')[0]?.properties).toMatchObject({ opened: true });
  });

  test('does not open when declined', async () => {
    const handle = createFakeContext();
    handle.prompter.scriptConfirm(false);

    await runOpenReportPrompt({ context: handle.ctx, htmlPath: '/tmp/report.html' });

    expect(handle.browserOpener.opened).toHaveLength(0);
    expect(handle.analytics.capturedEvents('report_open_choice')[0]?.properties).toMatchObject({ opened: false });
  });

  test('treats a cancelled prompt as no', async () => {
    const handle = createFakeContext();
    handle.prompter.scriptConfirm({ kind: 'cancelled' });

    await runOpenReportPrompt({ context: handle.ctx, htmlPath: '/tmp/report.html' });

    expect(handle.browserOpener.opened).toHaveLength(0);
    expect(handle.analytics.capturedEvents('report_open_choice')[0]?.properties).toMatchObject({ opened: false });
  });

  test('warns and points at the file when the browser fails to open', async () => {
    const handle = createFakeContext();
    handle.prompter.scriptConfirm(true);
    handle.browserOpener.fails({ kind: 'open-failed', message: 'no display' });

    await runOpenReportPrompt({ context: handle.ctx, htmlPath: '/tmp/report.html' });

    expect(handle.prompter.warns[0]).toContain('no display');
    expect(handle.prompter.warns[0]).toContain('/tmp/report.html');
  });
});
