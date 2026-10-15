import type { HTMLAttributes, ReactNode } from 'react';

type Props = Omit<HTMLAttributes<HTMLElement>, 'className'> & {
  children: ReactNode;
};

/** A game menu window for content on a light surface. */
export function Card({ children, ...attributes }: Props) {
  return (
    <article className="pixel-frame text-brand-ink px-4 py-3 sm:px-6 sm:py-5" {...attributes}>
      {children}
    </article>
  );
}
