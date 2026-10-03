/**
 * The palette Clerk needs as concrete values. Clerk renders its own DOM and
 * cannot read our CSS variables, so these repeat the hexes declared in
 * app/globals.css under the same names; scripts/clerk-palette.test.ts fails
 * when the two drift. The accent is one value in both themes on purpose.
 */
export const PALETTE: Record<'light' | 'dark', Record<string, string>> = {
  light: {
    surface: '#f5f7fa',
    raised: '#ffffff',
    ink: '#0b1220',
    muted: '#5b6478',
    accent: '#0b5fff',
    danger: '#c2271d',
  },
  dark: {
    surface: '#0d1424',
    raised: '#131b2d',
    ink: '#eaf0fa',
    muted: '#a3aec4',
    accent: '#0b5fff',
    danger: '#c2271d',
  },
};
