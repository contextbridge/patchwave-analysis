import { memo } from 'react';
import { type GlyphName, type IconName, glyphArt, icons, pixelPaths } from '../pixel/icons.ts';
import type { PaletteColor } from '../pixel/palette.ts';

type Props = ({ icon: IconName } | { glyph: GlyphName; color: PaletteColor }) & { size?: 'sm' | 'md' | 'lg' };

export const PixelIcon = memo(function PixelIcon(props: Props) {
  const art = 'icon' in props ? icons[props.icon] : glyphArt(props.glyph, props.color);
  const width = art.rows[0]?.length ?? 0;
  const height = art.rows.length;
  const { size = 'md' } = props;
  const scale = { sm: 1, md: 2, lg: 3 }[size];
  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width={width * scale}
      height={height * scale}
      shapeRendering="crispEdges"
      aria-hidden="true"
      className="block shrink-0"
    >
      {pixelPaths(art).map(({ fill, d }) => (
        <path key={fill} d={d} fill={fill} />
      ))}
    </svg>
  );
});
