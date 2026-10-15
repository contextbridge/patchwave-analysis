import { type PaletteColor, palette } from './palette.ts';

type PixelArt = { rows: readonly string[]; colors: Readonly<Record<string, string>> };

const ink = palette.violetNight;

// The pull request mark: a branch's two lines, each with its commit rings, one bending over to point back at the base.
const pullRequest = [
  '.xxx....x.....',
  'x...x..xx.....',
  'x...x.xxxxx...',
  'x...x..xx..x..',
  '.xxx....x..x..',
  '..x........x..',
  '..x........x..',
  '..x........x..',
  '..x........x..',
  '.xxx......xxx.',
  'x...x....x...x',
  'x...x....x...x',
  'x...x....x...x',
  '.xxx......xxx.',
];

// Each character is one art pixel; `.` is transparent.
export const icons = {
  clock: {
    rows: [
      '................',
      '.....oooooo.....',
      '...oowwwwwwoo...',
      '..owwwwwowwwwo..',
      '.owwwwwwowwwwwo.',
      '.owwwwwwowwwwwo.',
      'owwwwwwwowwwwwwo',
      'owowwwwwoooowowo',
      'owwwwwwwwwwwwwwo',
      'owwwwwwwwwwwwwpo',
      '.owwwwwwwwwwwpo.',
      '.owwwwwwwwwwwpo.',
      '..owwwwwowwwpo..',
      '...oowwwwwppoo..',
      '.....oooooo.....',
      '................',
    ],
    colors: { o: ink, w: palette.white, p: palette.violetLight },
  },
  shield: {
    rows: [
      '................',
      '.oooooooooooooo.',
      '.ohbbbbbwwwwwwo.',
      '.obbbbbbwwwwwwo.',
      '.obbbbbbwwwwwwo.',
      '.obbbbbbwwwwwwo.',
      '.obbbbbbwwwwwwo.',
      '.owwwwwwbbbbbbo.',
      '.owwwwwwbbbbbbo.',
      '..owwwwwbbbbbo..',
      '..owwwwwbbbbbo..',
      '...owwwwbbbbo...',
      '....owwwbbbo....',
      '.....owwbbo.....',
      '......oooo......',
      '................',
    ],
    colors: { o: ink, w: palette.white, b: palette.violet, h: palette.violetLight },
  },
  bolt: {
    rows: [
      '.........ooooo..',
      '........ohyyyo..',
      '.......ohyyyo...',
      '......ohyyyo....',
      '.....ohyyyo.....',
      '....oyyyyooooo..',
      '...oyyyyyyyyyo..',
      '...ooooyyyyyo...',
      '......oyyyyo....',
      '.....oyyyyo.....',
      '....oyyyyo......',
      '....oyyyo.......',
      '...oyyyo........',
      '...oyyo.........',
      '...ooo..........',
      '................',
    ],
    colors: { o: ink, y: palette.sun, h: palette.limePale },
  },
  sparkle: {
    rows: [
      '.....h.....',
      '.....h.....',
      '.....h.....',
      '....bhb....',
      '...bhhhb...',
      'hhhhhhhhhhh',
      '...bhhhb...',
      '....bhb....',
      '.....h.....',
      '.....h.....',
      '.....h.....',
    ],
    colors: { h: palette.white, b: palette.butter },
  },
  sparkleSmall: {
    rows: [
      '...........',
      '...........',
      '.....h.....',
      '.....h.....',
      '....bhb....',
      '..hhhhhhh..',
      '....bhb....',
      '.....h.....',
      '.....h.....',
      '...........',
      '...........',
    ],
    colors: { h: palette.white, b: palette.butter },
  },
  sparkleDot: {
    rows: [
      '...........',
      '...........',
      '...........',
      '...........',
      '.....b.....',
      '....bhb....',
      '.....b.....',
      '...........',
      '...........',
      '...........',
      '...........',
    ],
    colors: { h: palette.white, b: palette.butter },
  },
  pullRequest: pullRequestIcon(palette.purple),
} as const satisfies Record<string, PixelArt>;

export const glyphs = {
  play: ['.x......', '.xx.....', '.xxx....', '.xxxx...', '.xxx....', '.xx.....', '.x......', '........'],
} as const satisfies Record<string, readonly string[]>;

export type IconName = keyof typeof icons;
export type GlyphName = keyof typeof glyphs;

export function glyphArt(name: GlyphName, color: PaletteColor): PixelArt {
  return { rows: glyphs[name], colors: { x: palette[color] } };
}

// Group pixel runs by color to keep the SVG DOM small.
export function pixelPaths({ rows, colors }: PixelArt) {
  const paths = new Map<string, string>();
  rows.forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      const fill = colors[row[x] ?? '.'];
      let end = x + 1;
      while (end < row.length && row[end] === row[x]) end++;
      if (fill) paths.set(fill, `${paths.get(fill) ?? ''}M${x} ${y}h${end - x}v1H${x}z`);
      x = end;
    }
  });
  return [...paths].map(([fill, d]) => ({ fill, d }));
}

/** The pull request mark in `color`, outlined in ink so it stands out on any sky. */
function pullRequestIcon(color: string): PixelArt {
  const size = pullRequest.length + 2;
  const marked = (x: number, y: number) => pullRequest[y - 1]?.[x - 1] === 'x';
  const rows = Array.from({ length: size }, (_, y) =>
    Array.from({ length: size }, (_, x) => {
      if (marked(x, y)) return 'c';
      const touching = marked(x - 1, y) || marked(x + 1, y) || marked(x, y - 1) || marked(x, y + 1);
      return touching ? 'o' : '.';
    }).join(''),
  );
  return { rows, colors: { o: ink, c: color } };
}
