# Copied from the PatchWave repo

The report follows the PatchWave brand (`packages/website/BRAND.md` in the `contextbridge/patchwave` repo). These files are adapted from the sources below. Compare upstream changes before syncing; preserve the report-specific changes listed below.

| Here                                                                          | Source                                                                                                                              |
| ----------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `brand/patchHead.png`                                                         | `packages/website/src/assets/sprites/patchHead.png`                                                                                 |
| `brand/patchWaveWordmark.png`                                                 | `packages/website/src/assets/patchWaveWordmark.png`                                                                                 |
| `brand/patchHead.svg` (favicon)                                               | `packages/brand/src/assets/patchHead.svg`                                                                                           |
| Brand ramps and fonts in `styles.css`                                         | `packages/brand/src/colors.css`, `packages/website/src/styles/brand.css`                                                            |
| `primitives/Sprite.tsx`                                                       | `packages/website/src/components/ui/Sprite.tsx`                                                                                     |
| `pixel/*.ts` (scene engine, icons)                                            | `packages/website/src/pixel/` (`frame`, `palette`, `oceanScene`, `icons`, `icons.test`); `oceanScene` keeps only the sunset variant |
| `pixel/pixel.css`                                                             | The `pixel-*` utilities and animations in `packages/website/src/styles/tailwind.css`                                                |
| `primitives/{PixelCanvas,PixelIcon,PixelRule,PixelTile,WaveDivider,Card}.tsx` | `packages/website/src/components/ui/`                                                                                               |
| Pixel variants in `components/ui/button.tsx`                                  | `packages/website/src/components/ui/Button.tsx`                                                                                     |

Ruder Plakat, the site's headline font, is licensed for `patchwave.ai` only. Don't copy it here; headlines use Radio Canada bold and the logo uses the wordmark PNG.

Local changes to the copies: imports are relative, `icons.test.ts` runs under `bun:test`, `PixelRule` fits the report column, `Sprite` hardcodes PNG sizes, `Card` has a single padding, `WaveDivider` requires its variant, and `pixel-frame` uses `border-image` longhands because Bun's CSS minifier drops the url from the shorthand. `pixel.css` adds the report's own `pixel-text-shadow` utility.

The report keeps only what it uses: the icons and glyphs it draws, the brand colors it references in `styles.css`, the `pixel-*` utilities and animations it applies (no `pixel-on-dark` or `bob`), and `Sprite`'s fixed whole-number scale (no large-breakpoint scale, motion or alt text). `frame.ts` drops the `hash` noise helper, and the arcade canvas state and card nub are omitted. Preserve these reductions when syncing.
