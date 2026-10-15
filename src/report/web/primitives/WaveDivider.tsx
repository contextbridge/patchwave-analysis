type Props = {
  /** `into` rises into a scene below it; `out` hangs from one above it. */
  variant: 'into' | 'out';
};

export function WaveDivider({ variant }: Props) {
  return <div aria-hidden="true" className={`pixel-waves ${variant === 'out' ? '-scale-y-100' : ''}`} />;
}
