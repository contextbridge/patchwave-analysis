import type { Context } from '../context.ts';
import { type Prompter, formatPromptError } from '../prompt/Prompter.ts';
import { type BundleKind, formatUploadError } from '../upload/Uploader.ts';

const SUPPORT_LINE = 'Reach us at founders@contextbridge.ai — or learn more at https://patchwave.ai';

export type ShareChoice = 'html' | 'full' | 'declined';

export interface SharePromptInputs {
  readonly context: Context;
  readonly target: string;
  readonly htmlPath: string;
  readonly zipPath: string;
  readonly htmlContent: string;
  readonly zipBytes: Uint8Array;
  readonly identifier: string;
}

export type ShareOutcome =
  | { kind: 'shared'; choice: 'html' | 'full'; uploadId: string; identifier: string }
  | { kind: 'declined' }
  | { kind: 'cancelled' }
  | { kind: 'upload-failed'; choice: 'html' | 'full'; message: string };

export async function runSharePrompt(inputs: SharePromptInputs): Promise<ShareOutcome> {
  const { prompter, analytics, uploader } = inputs.context;

  prompter.note(
    [
      `Scanned:          ${inputs.target}`,
      `HTML report:      ${inputs.htmlPath}`,
      `Raw data bundle:  ${inputs.zipPath}`,
      '',
      "Open either file to see what would be sent — we'll upload exactly what's on disk.",
    ].join('\n'),
    'Report ready',
  );

  analytics.capture('share_prompt_shown', {});

  const choiceResult = await prompter.select<ShareChoice>({
    message: "Would you like to share this with us? We won't share your data with anyone.",
    initialValue: 'full',
    choices: [
      { value: 'full', label: 'Share the HTML report + raw data', hint: 'the full .zip you saw above' },
      { value: 'html', label: 'Share the HTML report only', hint: 'the .html, no raw data' },
      { value: 'declined', label: 'No thanks — keep it local', hint: 'nothing leaves your machine' },
    ],
  });

  if (choiceResult.isErr()) {
    analytics.capture('share_choice', { choice: 'cancelled' });
    if (choiceResult.error.kind !== 'cancelled') prompter.warn(formatPromptError(choiceResult.error));
    declinedOutro(inputs);
    return { kind: 'cancelled' };
  }

  const choice = choiceResult.value;
  analytics.capture('share_choice', { choice });

  if (choice === 'declined') {
    declinedOutro(inputs);
    return { kind: 'declined' };
  }

  const identifierResult = await maybeAskForEmail(prompter, inputs.identifier);
  if (identifierResult.kind === 'cancelled') {
    declinedOutro(inputs);
    return { kind: 'cancelled' };
  }
  const identifier = identifierResult.identifier;

  const kind: BundleKind = choice === 'html' ? 'html' : 'zip';
  const bytes = choice === 'html' ? new TextEncoder().encode(inputs.htmlContent) : inputs.zipBytes;

  const spinner = prompter.spinner();
  spinner.start('Uploading...');
  const uploadResult = await uploader.upload({
    bytes,
    kind,
    identifier,
    appVersion: inputs.context.appVersion,
    timestamp: inputs.context.clock.now().toString(),
  });

  if (uploadResult.isErr()) {
    const message = formatUploadError(uploadResult.error);
    spinner.stop('Upload failed.');
    analytics.capture('upload_failed', { mode: choice, error_kind: uploadResult.error.kind });
    prompter.error(message);
    prompter.note(
      [`Your local files are unchanged:`, `  ${inputs.htmlPath}`, `  ${inputs.zipPath}`, '', SUPPORT_LINE].join('\n'),
      "We couldn't upload",
    );
    return { kind: 'upload-failed', choice, message };
  }

  const { uploadId } = uploadResult.value;
  spinner.stop('Uploaded.');
  analytics.capture('upload_succeeded', { mode: choice });
  prompter.outro(`Thanks for sharing! Upload id: ${uploadId}. We'll be in touch if anything jumps out.`);
  return { kind: 'shared', choice, uploadId, identifier };
}

function declinedOutro(inputs: SharePromptInputs): void {
  const { prompter } = inputs.context;
  prompter.note(
    [
      `No worries — nothing was uploaded. Your report lives here:`,
      `  ${inputs.htmlPath}`,
      `  ${inputs.zipPath}`,
      '',
      `Want help cutting your Dependabot burden? ${SUPPORT_LINE}`,
    ].join('\n'),
    'All set',
  );
  prompter.outro('Done.');
}

async function maybeAskForEmail(
  prompter: Prompter,
  fallbackIdentifier: string,
): Promise<{ kind: 'ok'; identifier: string } | { kind: 'cancelled' }> {
  const result = await prompter.text({
    message: 'Email (optional, so we can follow up):',
    placeholder: 'leave blank to stay anonymous',
    defaultValue: '',
    validate: (value) => {
      const trimmed = value.trim();
      if (trimmed.length === 0) return undefined;
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed) ? undefined : "that doesn't look like an email address";
    },
  });

  if (result.isErr()) {
    if (result.error.kind === 'cancelled') return { kind: 'cancelled' };
    prompter.warn(formatPromptError(result.error));
    return { kind: 'ok', identifier: fallbackIdentifier };
  }

  const trimmed = result.value.trim();
  return { kind: 'ok', identifier: trimmed.length > 0 ? trimmed : fallbackIdentifier };
}
