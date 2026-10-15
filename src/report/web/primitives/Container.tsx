import type { ReactNode } from 'react';
import { cn } from '../lib/utils.ts';

/** The report's content column. `className` adds vertical spacing or layout. */
export function Container({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn('mx-auto max-w-[1024px] px-6', className)}>{children}</div>;
}
