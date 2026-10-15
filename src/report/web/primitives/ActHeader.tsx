import type { ReactNode } from 'react';
import type { IconName } from '../pixel/icons.ts';
import { PixelIcon } from './PixelIcon.tsx';

interface Props {
  icon: IconName;
  eyebrow: string;
  headingTestId?: string;
  children: ReactNode;
}

export function ActHeader({ icon, eyebrow, headingTestId, children }: Props) {
  return (
    <>
      <div className="eyebrow text-muted-foreground flex items-center gap-3">
        <PixelIcon icon={icon} />
        {eyebrow}
      </div>
      <h2
        data-testid={headingTestId}
        className="text-foreground mt-3 text-3xl leading-tight font-bold text-balance sm:text-4xl"
      >
        {children}
      </h2>
    </>
  );
}
