import { formatBrowserOpenError } from '../context/BrowserOpener.ts';
import type { Context } from '../context/index.ts';

interface OpenReportInputs {
  readonly context: Context;
  readonly htmlPath: string;
}

/** Opens the report, degrading to its on-disk path when the browser cannot launch. */
export async function openReport(inputs: OpenReportInputs): Promise<void> {
  const { prompter, analytics, browserOpener } = inputs.context;

  const opened = await browserOpener.open(inputs.htmlPath);
  analytics.capture('report_browser_open', { success: opened.isOk() });
  if (opened.isErr()) {
    prompter.warn(`${formatBrowserOpenError(opened.error)} Open it yourself: ${inputs.htmlPath}`);
  }
}
