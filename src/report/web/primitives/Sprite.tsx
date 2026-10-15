import patchHead from '../brand/patchHead.png';

// Sizes are the PNGs' 1x dimensions; Astro reads them from the file on the site, Bun's loader only gives a URL.
const sprites = {
  patchHead: { src: patchHead, width: 34, height: 35 },
};

type Props = {
  sprite: keyof typeof sprites;
  scale: 1 | 3;
};

/** A 1x pixel-art PNG scaled by a whole number, so every art pixel stays square and sharp. */
export function Sprite({ sprite, scale }: Props) {
  const { src, width, height } = sprites[sprite];
  return <img src={src} width={width * scale} height={height * scale} alt="" className="pixelated block shrink-0" />;
}
