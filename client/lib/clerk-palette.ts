/**
 * The palette Clerk needs as concrete values. Clerk renders its own DOM and
 * cannot read our CSS variables, so these repeat the hexes declared in
 * app/globals.css under the same names; scripts/clerk-palette.test.ts fails
 * when the two drift. The accent is one value in both themes on purpose.
 */
export const PALETTE: Record<'light' | 'dark', Record<string, string>> = {
  light: {
    surface: '#faf9fe',
    raised: '#ffffff',
    ink: '#26213f',
    muted: '#645e7e',
    accent: '#5b45e0',
    danger: '#c2271d',
  },
  dark: {
    surface: '#151323',
    raised: '#1e1a30',
    ink: '#f0ecff',
    muted: '#b6adc9',
    accent: '#5b45e0',
    danger: '#c2271d',
  },
};
