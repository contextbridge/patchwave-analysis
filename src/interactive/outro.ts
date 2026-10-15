import type { Context } from '../context/index.ts';
import { PATCHWAVE_URL, withUtm } from '../urls.ts';

export function showOutro(ctx: Context): void {
  const { prompter } = ctx;
  const link = terminalLink(PATCHWAVE_URL.replace(/\/$/, ''), withUtm(PATCHWAVE_URL, { medium: 'cli' }));
  prompter.outro(`Learn more about PatchWave: ${link}`);
}

// OSC 8 hyperlink. Terminals without hyperlink support ignore the escape codes and print only the text.
function terminalLink(text: string, url: string): string {
  return `\u001B]8;;${url}\u0007${text}\u001B]8;;\u0007`;
}
