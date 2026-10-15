import type { ReactNode } from 'react';

/** A mono caps heading for a block within an act. */
export function SubHeading({ children }: { children: ReactNode }) {
  return <h3 className="text-foreground font-mono text-sm font-bold tracking-wider uppercase">{children}</h3>;
}
