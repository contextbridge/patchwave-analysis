import { type PixelFrame, cssLength } from './frame.ts';
import { packedPalette as color } from './palette.ts';

const textureSize = 64;
const texture = createWaterTexture();

type Cloud = { sprite: Sprite; x: number; y: number; speed: number };
type Sprite = { width: number; height: number; pixels: Uint32Array };

const cloudSprite = createCloud(20, 7);

/**
 * A banded sunset sky over a Mode 7 ocean: each row of water samples a flat texture at a distance that grows toward
 * the horizon. The water's height comes from the container's --ocean custom property.
 */
export function createOceanScene(frame: PixelFrame) {
  const { width, height, pixels } = frame;
  const horizon = Math.max(1, height - cssLength(frame, '--ocean', 208));
  const sunX = Math.round(width * (width >= 200 ? 0.78 : 0.7));
  const sunRadius = 16;
  const sky = createSky(width, horizon, sunX, sunRadius);
  const clouds: Cloud[] = [{ sprite: cloudSprite, x: width * 0.55, y: horizon - 20, speed: 0.3 }];

  return (time: number) => {
    pixels.set(sky);
    clouds.forEach((cloud, index) => drawCloud(cloud, index, time));
    drawWater(time);
  };

  function drawCloud({ sprite, x, y, speed }: Cloud, index: number, time: number) {
    // Clouds sway in place so they never drift behind the headline.
    const left = Math.round(x + Math.sin((time / 1000) * speed * 0.2 + index * 2) * 10);
    for (let row = 0; row < sprite.height; row++) {
      const screenY = Math.round(y) + row;
      if (screenY < 0 || screenY >= horizon) continue;
      for (let column = 0; column < sprite.width; column++) {
        const value = sprite.pixels[row * sprite.width + column] ?? 0;
        const screenX = left + column;
        if (value && screenX >= 0 && screenX < width) pixels[screenY * width + screenX] = value;
      }
    }
  }

  function drawWater(time: number) {
    const cameraZ = time * 0.006;
    const cameraX = time * 0.0012;
    const twinkle = Math.floor(time / 180) % 2;
    for (let y = horizon; y < height; y++) {
      const depth = y - horizon + 1;
      const row = y * width;
      if (depth <= 2) {
        // The rows nearest the horizon alias badly, so they get a flat dithered haze instead.
        for (let x = 0; x < width; x++) {
          pixels[row + x] = depth === 1 || (x + y) % 2 ? color.violetLight : color.violet;
        }
        continue;
      }
      const distance = 600 / depth;
      const v = wrap(Math.floor(distance + cameraZ));
      const glare = 1 + depth * 0.35;
      for (let x = 0; x < width; x++) {
        const u = wrap(Math.floor(((x - width / 2) * distance) / 60 + cameraX));
        let value = texture[v * textureSize + u] ?? color.violetDeep;
        if (
          Math.abs(x - sunX) < glare &&
          (value === color.violetPale ||
            value === color.violetLight ||
            (value === color.violet && (x + depth + twinkle) % 3 === 0))
        ) {
          value = value === color.violetPale ? color.limePale : color.butter;
        }
        pixels[row + x] = value;
      }
    }
  }
}

function wrap(value: number) {
  return ((value % textureSize) + textureSize) % textureSize;
}

function createWaterTexture() {
  const pixels = new Uint32Array(textureSize * textureSize);
  for (let v = 0; v < textureSize; v++) {
    for (let u = 0; u < textureSize; u++) {
      const phase = Math.round(2 * Math.sin((u / textureSize) * Math.PI * 4));
      const band = (((v + phase) % 8) + 8) % 8;
      let value = color.violetDeep;
      if (band === 0) value = (u + v * 3) % 16 < 5 ? color.violetPale : color.violetLight;
      else if (band === 1) value = u % 12 < 7 ? color.violet : color.violetDeep;
      else if (band === 5) value = u % 10 < 4 ? color.violetNight : color.violetDeep;
      pixels[v * textureSize + u] = value;
    }
  }
  return pixels;
}

function createCloud(width: number, height: number): Sprite {
  const blobs = [
    [width * 0.3, height * 0.62, width * 0.26, height * 0.38],
    [width * 0.55, height * 0.45, width * 0.24, height * 0.45],
    [width * 0.75, height * 0.66, width * 0.22, height * 0.34],
    [width * 0.5, height * 0.78, width * 0.48, height * 0.22],
  ] as const;
  const inside = (x: number, y: number) =>
    blobs.some(([cx, cy, rx, ry]) => ((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2 <= 1);
  const pixels = new Uint32Array(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (!inside(x, y)) continue;
      let value = color.violetPale;
      if (!inside(x, y + 1) || !inside(x, y + 2)) value = color.violetLight;
      else if (!inside(x, y - 1)) value = color.white;
      pixels[y * width + x] = value;
    }
  }
  return { width, height, pixels };
}

function createSky(width: number, horizon: number, sunX: number, sunRadius: number) {
  const sky = new Uint32Array(width * horizon);
  // Bands from the horizon up, in art pixels. Each band's first row is dithered into the one below it.
  const bands = [
    [color.butter, 3],
    [color.pinkPale, 5],
    [color.pink, 7],
    [color.violetLight, 5],
    [color.violet, 8],
    [color.violetDeep, 14],
  ] as const;
  const starts: number[] = [];
  let top = 0;
  for (const [, bandHeight] of bands) {
    starts.push(top);
    top += bandHeight;
  }
  for (let y = 0; y < horizon; y++) {
    const above = horizon - 1 - y;
    const index = bands.findIndex(([, bandHeight], band) => above < (starts[band] ?? 0) + bandHeight);
    const band = index === -1 ? bands.length : index;
    const value = bands[band]?.[0] ?? color.violetNight;
    const below = bands[band - 1]?.[0] ?? value;
    const firstRow = above === (starts[band] ?? top);
    for (let x = 0; x < width; x++) {
      sky[y * width + x] = firstRow && band > 0 && (x + y) % 2 === 0 ? below : value;
    }
  }

  for (let y = Math.max(0, horizon - sunRadius); y < horizon; y++) {
    for (let x = Math.max(0, sunX - sunRadius); x <= Math.min(width - 1, sunX + sunRadius); x++) {
      const distance = (x - sunX) ** 2 + (y - horizon) ** 2;
      if (distance <= sunRadius ** 2)
        sky[y * width + x] = distance <= (sunRadius - 4) ** 2 ? color.limePale : color.sun;
    }
  }

  const island = (centerX: number, halfWidth: number, rows: number) => {
    for (let row = 0; row < rows; row++) {
      const span = halfWidth - row * 3;
      const y = horizon - 1 - row;
      for (let x = Math.round(centerX - span); x <= Math.round(centerX + span); x++) {
        if (x >= 0 && x < width && y >= 0) sky[y * width + x] = color.violetNight;
      }
    }
  };
  const palmX = Math.round(width * 0.18);
  island(palmX, 9, 3);
  island(Math.round(width * 0.36), 5, 2);
  const palm = [
    [0, 3],
    [0, 4],
    [1, 5],
    [1, 6],
    [1, 7],
    [2, 8],
    [-1, 8],
    [0, 8],
    [1, 8],
    [3, 7],
    [-2, 7],
    [4, 6],
    [-3, 7],
  ] as const;
  for (const [dx, dy] of palm) {
    const x = palmX + dx;
    const y = horizon - 1 - dy;
    if (x >= 0 && x < width && y >= 0) sky[y * width + x] = color.violetNight;
  }
  return sky;
}
