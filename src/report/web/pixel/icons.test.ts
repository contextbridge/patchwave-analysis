import { describe, expect, it } from 'bun:test';
import { glyphArt, glyphs, icons, pixelPaths } from './icons.ts';

describe('icons', () => {
  it.each(Object.entries(icons))('draws %s on a square grid with a color for every pixel', (_, { rows, colors }) => {
    for (const row of rows) {
      expect(row).toHaveLength(rows.length);
      for (const character of row.replaceAll('.', '')) expect(colors).toHaveProperty(character);
    }
  });

  it.each(Object.entries(glyphs))('draws the %s glyph on an 8x8 grid', (_, rows) => {
    expect(rows).toHaveLength(8);
    for (const row of rows) expect(row).toMatch(/^[.x]{8}$/);
  });
});

describe('pixelPaths', () => {
  it('draws each color as one path of its runs and skips transparent pixels', () => {
    expect(pixelPaths({ rows: ['.aab', 'bb..'], colors: { a: '#000000', b: '#ffffff' } })).toEqual([
      { fill: '#000000', d: 'M1 0h2v1H1z' },
      { fill: '#ffffff', d: 'M3 0h1v1H3zM0 1h2v1H0z' },
    ]);
  });

  it('merges characters that share a color into one path', () => {
    expect(pixelPaths({ rows: ['ab'], colors: { a: '#000000', b: '#000000' } })).toEqual([
      { fill: '#000000', d: 'M0 0h1v1H0zM1 0h1v1H1z' },
    ]);
  });

  it('colors glyphs with the requested palette color', () => {
    const paths = pixelPaths(glyphArt('play', 'lime'));
    expect(paths).toHaveLength(1);
    expect(paths[0]?.fill).toBe('#f6ffb4');
    expect(paths[0]?.d).toMatch(/^M1 0h1v1H1z/);
  });
});
