import { Inter } from 'next/font/google';

// The canvas shows the email, not the app, so its type is the email's: Inter,
// the renderer's default face, and not the shell's Figtree. It is loaded
// here, from the module the editor imports, and not in the root layout, so
// the marketing pages and the dashboard never download it — the template
// editor and the playground are the only routes that reach this file. One
// variable file, normal style only: the rendered email asks for the same
// single file, so an italic here is synthesised exactly as it is there.
//
// Only Inter is loaded on purpose. A template whose theme names another
// `font` still paints in Inter on the canvas; the sent email carries the
// theme's own web font, which the canvas does not download to preview.
const inter = Inter({ subsets: ['latin'], display: 'swap' });

/** The canvas's `--mly-font-family`: the self-hosted face, the metric-matched
 *  fallback next/font generates behind it so the swap does not move the
 *  layout, and a generic last. */
export const CANVAS_FONT_FAMILY = `${inter.style.fontFamily}, sans-serif`;
