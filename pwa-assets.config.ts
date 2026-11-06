/**
 * Generation of the app icons (install icons of the PWA, Apple touch icon)
 * from public/favicon.svg, with `npm run pwa:icons`. The PNGs land next to the
 * SVG in public/ and are committed: they only change when the logo does.
 *
 * Preset "minimal 2023": 64, 192 and 512 px icons, a 512 px maskable one
 * (Android crops it to a circle or a squircle, so the logo gets padding) and
 * the 180 px Apple touch icon (iOS ignores the manifest icons).
 */
import { defineConfig, minimal2023Preset } from '@vite-pwa/assets-generator/config'

// The favicon's own dark background (see favicon.svg): maskable and Apple
// icons are filled edge to edge, so their padding must be the same color.
const background = '#0f172a'

export default defineConfig({
  preset: {
    ...minimal2023Preset,
    // No favicon: the preset would overwrite public/favicon.ico (hand-made
    // with 16, 32 and 48 px renders) with a single 48 px one.
    transparent: { ...minimal2023Preset.transparent, favicons: [] },
    maskable: { ...minimal2023Preset.maskable, resizeOptions: { background } },
    apple: { ...minimal2023Preset.apple, resizeOptions: { background } },
  },
  images: ['public/favicon.svg'],
})
