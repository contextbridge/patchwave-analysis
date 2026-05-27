import { describe, expect, test } from 'bun:test';
import { createFakeContext } from '../testHelpers/createFakeContext.ts';
import { openReport } from './openReport.ts';

describe('openReport', () => {
  test('opens the report in the browser automatically', async () => {
    const handle = createFakeContext();

    await openReport({ context: handle.ctx, htmlPath: '/tmp/report.html' });

    expect(handle.browserOpener.opened).toEqual(['/tmp/report.html']);
    expect(handle.analytics.capturedEvents('report_browser_open')[0]?.properties).toMatchObject({ success: true });
  });

  test('does not warn when the browser opens cleanly', async () => {
    const handle = createFakeContext();

    await openReport({ context: handle.ctx, htmlPath: '/tmp/report.html' });

    expect(handle.prompter.warns).toHaveLength(0);
  });

  test('warns and points at the file when the browser fails to open', async () => {
    const handle = createFakeContext();
    handle.browserOpener.fails({ kind: 'open-failed', message: 'no display' });

    await openReport({ context: handle.ctx, htmlPath: '/tmp/report.html' });

    expect(handle.prompter.warns[0]).toContain('no display');
    expect(handle.prompter.warns[0]).toContain('/tmp/report.html');
    expect(handle.analytics.capturedEvents('report_browser_open')[0]?.properties).toMatchObject({ success: false });
  });
});
