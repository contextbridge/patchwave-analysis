import type { ReactNode } from 'react';

export function NotMeasured({ children }: { children: ReactNode }) {
  return <span className="text-muted-foreground italic">{children}</span>;
}
