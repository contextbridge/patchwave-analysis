import type { Context } from '../context.ts';
import { type Prompter, formatPromptError } from '../prompt/Prompter.ts';
import { formatUploadError } from '../upload/Uploader.ts';

const SUPPORT_LINE = 'Reach us at founders@contextbridge.ai — or learn more at https://patchwave.ai';

export type ShareChoice = 'html' | 'declined';

export interface SharePromptInputs {
  readonly context: Context;
  readonly target: string;
  readonly htmlPath: string;
  readonly htmlContent: string;
}

export type ShareOutcome =
  | { kind: 'shared'; uploadId: string; email: string }
  | { kind: 'declined' }
  | { kind: 'cancelled' }
  | { kind: 'upload-failed'; message: string };

export async function runSharePrompt(inputs: SharePromptInputs): Promise<ShareOutcome> {
  const { prompter, analytics, uploader } = inputs.context;

  prompter.note([`Scanned:      ${inputs.target}`, `HTML report:  ${inputs.htmlPath}`].join('\n'), 'Report ready');

  analytics.capture('share_prompt_shown', {});

  const choiceResult = await prompter.select<ShareChoice>({
    message:
      "Share this report with PatchWave? Uploading it bumps your spot on the waitlist. We'll upload exactly what's on disk and won't share your data with anyone.",
    initialValue: 'html',
    choices: [
      { value: 'html', label: 'Share the HTML report', hint: 'boost your waitlist spot' },
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

  const emailResult = await askForEmail(prompter);
  if (emailResult.kind === 'cancelled') {
    declinedOutro(inputs);
    return { kind: 'cancelled' };
  }
  const email = emailResult.email;

  const spinner = prompter.spinner();
  spinner.start('Uploading...');
  const uploadResult = await uploader.upload({
    bytes: new TextEncoder().encode(inputs.htmlContent),
    owner: inputs.target,
    email,
    appVersion: inputs.context.appVersion,
    timestamp: inputs.context.clock.now().toString(),
  });

  if (uploadResult.isErr()) {
    const message = formatUploadError(uploadResult.error);
    spinner.stop('Upload failed.');
    analytics.capture('upload_failed', { error_kind: uploadResult.error.kind });
    prompter.error(message);
    prompter.note(
      [`Your local report is unchanged:`, `  ${inputs.htmlPath}`, '', SUPPORT_LINE].join('\n'),
      "We couldn't upload",
    );
    return { kind: 'upload-failed', message };
  }

  const { uploadId } = uploadResult.value;
  spinner.stop('Uploaded.');
  analytics.capture('upload_succeeded', {});
  prompter.outro(
    `Thanks — you're on the PatchWave waitlist. We'll use this report to prioritize early access and follow up at ${email}.`,
  );
  return { kind: 'shared', uploadId, email };
}

function declinedOutro(inputs: SharePromptInputs): void {
  const { prompter } = inputs.context;
  prompter.note(
    [
      `No worries — nothing was uploaded. Your report lives here:`,
      `  ${inputs.htmlPath}`,
      '',
      `Want help cutting your Dependabot burden? ${SUPPORT_LINE}`,
    ].join('\n'),
    'All set',
  );
  prompter.outro('Done.');
}

async function askForEmail(prompter: Prompter): Promise<{ kind: 'ok'; email: string } | { kind: 'cancelled' }> {
  const result = await prompter.text({
    message: 'Email:',
    placeholder: 'you@example.com',
    validate: (value) => {
      const trimmed = value.trim();
      if (trimmed.length === 0) return 'Please enter an email address for the waitlist.';
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed) ? undefined : "that doesn't look like an email address";
    },
  });

  if (result.isErr()) {
    if (result.error.kind === 'cancelled') return { kind: 'cancelled' };
    prompter.warn(formatPromptError(result.error));
    return { kind: 'cancelled' };
  }

  const trimmed = result.value.trim();
  return { kind: 'ok', email: trimmed };
}
