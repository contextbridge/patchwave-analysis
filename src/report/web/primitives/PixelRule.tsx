/** A 16-bit menu separator, for a break between two sections on the same surface. */
export function PixelRule() {
  return (
    <div aria-hidden="true" className="flex w-full items-center gap-3">
      <span className="h-0.5 flex-1 bg-brand-violet-light" />
      <span className="pixel-diamond" />
      <span className="h-0.5 flex-1 bg-brand-violet-light" />
    </div>
  );
}
