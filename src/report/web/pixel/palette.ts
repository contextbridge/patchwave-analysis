import { packColor } from './frame.ts';

/**
 * The brand ramps from BRAND.md, for pixel art drawn in code. Mirrors the tokens in `@patchwave/brand/colors.css`
 * and the website's overrides in brand.css.
 */
export const palette = {
  white: '#ffffff',
  ink: '#000000',
  violetPale: '#ecebfd',
  violetLight: '#9babf9',
  violet: '#5a49ff',
  violetDeep: '#2211e3',
  violetNight: '#130a7b',
  limePale: '#faffd6',
  lime: '#f6ffb4',
  butter: '#fef29e',
  sun: '#fde447',
  pinkPale: '#f2cbff',
  pink: '#e188ff',
  magenta: '#d862ff',
  purple: '#cb2dff',
} as const;

export type PaletteColor = keyof typeof palette;

/** The palette packed for writing straight into a canvas's pixel buffer. */
export const packedPalette = Object.fromEntries(
  Object.entries(palette).map(([name, hex]) => [name, packColor(hex)]),
) as Record<PaletteColor, number>;
