import { formatBrowserOpenError } from '../BrowserOpener.ts';
import type { Context } from '../context.ts';

export interface OpenReportInputs {
  readonly context: Context;
  readonly htmlPath: string;
}

/**
 * Open the freshly generated report in the user's browser, before the share
 * prompt so they can eyeball it before deciding whether to send it. A failed
 * launch degrades to a warning that points at the file on disk; either way the
 * share prompt that follows prints the path. Never aborts the run.
 */
export async function openReport(inputs: OpenReportInputs): Promise<void> {
  const { prompter, analytics, browserOpener } = inputs.context;

  const opened = await browserOpener.open(inputs.htmlPath);
  analytics.capture('report_browser_open', { success: opened.isOk() });
  if (opened.isErr()) {
    prompter.warn(`${formatBrowserOpenError(opened.error)} Open it yourself: ${inputs.htmlPath}`);
  }
}
