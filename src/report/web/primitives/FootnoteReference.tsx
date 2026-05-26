import type { ReactNode } from 'react';
import { useAssumptionsDisclosure } from '../hooks/useAssumptionsDisclosure.tsx';
import { type FootnoteRegistration, useFootnote } from '../hooks/useFootnotes.tsx';
import { cn } from '../lib/utils.ts';
import { footnoteMarkerClass } from './FootnoteMarker.tsx';

export const footnoteReferenceTestId = 'footnote-reference';

interface Props extends FootnoteRegistration {
  kind?: 'note' | 'assumptions';
  className?: string;
  testId?: string;
  titleText?: string;
  onClick?: () => void;
}

export function FootnoteReference({
  id,
  title,
  body,
  kind = 'note',
  className,
  testId = footnoteReferenceTestId,
  titleText,
  onClick,
}: Props) {
  const number = useFootnote({ id, title, body });
  const { reveal } = useAssumptionsDisclosure();
  const href = kind === 'assumptions' ? '#appendix-assumptions' : '#appendix-sources';

  return (
    <a
      href={href}
      data-testid={testId}
      title={titleText ?? title}
      onClick={() => {
        onClick?.();
        reveal();
      }}
      className={cn(footnoteMarkerClass, className)}
    >
      {number}
    </a>
  );
}

export function FootnoteBodyLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className="text-primary underline underline-offset-4">
      {children}
    </a>
  );
}
