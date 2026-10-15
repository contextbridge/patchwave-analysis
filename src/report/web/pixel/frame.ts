/** A canvas-backed image measured in art pixels. */
export type PixelFrame = {
  width: number;
  height: number;
  /** CSS pixels per art pixel. */
  pixel: number;
  pixels: Uint32Array;
  container: HTMLElement;
};

/** Draws the frame at a time in milliseconds. */
export type DrawFrame = (time: number) => void;

export type PixelScene = (frame: PixelFrame) => DrawFrame;

/** Packs a #rrggbb color for a Uint32Array view over ImageData, which is little-endian RGBA. */
export function packColor(hex: string) {
  const value = Number.parseInt(hex.slice(1), 16);
  return (0xff000000 | ((value & 0xff) << 16) | (value & 0xff00) | ((value >> 16) & 0xff)) >>> 0;
}

/** Reads a CSS length custom property from the frame's container and converts it to art pixels. */
export function cssLength(frame: PixelFrame, property: string, fallback: number) {
  const value = Number.parseFloat(getComputedStyle(frame.container).getPropertyValue(property));
  return Math.round((Number.isNaN(value) ? fallback : value) / frame.pixel);
}
