import type { ReactNode } from 'react';

type Props = {
  tone: 'violet' | 'ink';
  size: 'icon' | 'bust';
  shape?: 'rounded' | 'circle';
  children: ReactNode;
};

const tones = { violet: 'bg-brand-violet-pale', ink: 'bg-brand-ink' };
const sizes = { icon: 'size-11', bust: 'size-32' };
const corners = { icon: 'rounded-lg', bust: 'rounded-2xl' };

/** The slot pixel art sits in inside interface elements: a rounded, dithered tile. */
export function PixelTile({ tone, size, shape = 'rounded', children }: Props) {
  return (
    <span
      className={`pixel-dither ring-brand-violet-night/15 grid shrink-0 place-items-center overflow-hidden ring-1 ring-inset ${tones[tone]} ${sizes[size]} ${shape === 'circle' ? 'rounded-full' : corners[size]}`}
    >
      {children}
    </span>
  );
}
