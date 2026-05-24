import { formatBrowserOpenError } from '../BrowserOpener.ts';
import type { Context } from '../context.ts';

export interface OpenReportPromptInputs {
  readonly context: Context;
  readonly htmlPath: string;
}

/**
 * Offer to open the freshly generated report in the user's browser. Defaults to
 * "yes". Shown before the share prompt so they can eyeball the report before
 * deciding whether to send it. A cancel or prompt error is treated as "no", and
 * a failed launch degrades to pointing at the file on disk — neither aborts the run.
 */
export async function runOpenReportPrompt(inputs: OpenReportPromptInputs): Promise<void> {
  const { prompter, analytics, browserOpener } = inputs.context;

  const choice = await prompter.confirm({
    message: 'Open the report in your browser?',
    defaultValue: true,
  });

  const shouldOpen = choice.unwrapOr(false);
  analytics.capture('report_open_choice', { opened: shouldOpen });
  if (!shouldOpen) return;

  const opened = await browserOpener.open(inputs.htmlPath);
  if (opened.isErr()) {
    prompter.warn(`${formatBrowserOpenError(opened.error)} Open it yourself: ${inputs.htmlPath}`);
  }
}
