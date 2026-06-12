import { Check, Copy } from 'lucide-react';
import { useState } from 'react';
import { Button } from '../components/ui/button.tsx';

export const commandBlockTestIds = {
  copy: 'command-block-copy',
} as const;

const COPIED_RESET_MS = 2000;

interface CommandBlockProps {
  command: string;
  // Names what is being copied, for the button's accessible label ("Copy the install command").
  label?: string;
  testId?: string;
}

// A shell command in the report's dark command style, with a copy button that
// mirrors patchwave.ai's behavior: click to copy, swap to a "Copied" check for a
// couple of seconds, then reset.
export function CommandBlock({ command, label = 'the command', testId }: CommandBlockProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    copyToClipboard(command);
    setCopied(true);
    window.setTimeout(() => setCopied(false), COPIED_RESET_MS);
  };

  return (
    <div
      data-testid={testId}
      className="bg-foreground text-background mt-4 flex items-center gap-3 rounded-md py-2 pr-2 pl-4"
    >
      <code className="flex-1 overflow-x-auto font-mono text-sm whitespace-pre">{command}</code>
      <Button
        type="button"
        size="sm"
        variant="ghost"
        onClick={handleCopy}
        data-testid={commandBlockTestIds.copy}
        aria-label={copied ? `Copied ${label}` : `Copy ${label}`}
        className="text-background hover:bg-background/15 hover:text-background shrink-0"
      >
        {copied ? <Check /> : <Copy />}
        {copied ? 'Copied' : 'Copy'}
      </Button>
    </div>
  );
}

// Prefer the async Clipboard API; fall back to a hidden textarea + execCommand for
// the rare context where it is blocked (matches the patchwave.ai site).
function copyToClipboard(text: string): void {
  if (navigator.clipboard?.writeText) {
    void navigator.clipboard.writeText(text).catch(() => legacyCopy(text));
    return;
  }
  legacyCopy(text);
}

function legacyCopy(text: string): void {
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();
  document.execCommand('copy');
  document.body.removeChild(textarea);
}
