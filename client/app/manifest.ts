import type { MetadataRoute } from 'next';

/** Served at /manifest.webmanifest: what a browser shows when the site is
 *  added to a home screen or installed. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Temply',
    short_name: 'Temply',
    description: 'A block editor for transactional email. Build it without code, send it from your own app.',
    start_url: '/dashboard',
    display: 'standalone',
    background_color: '#ffffff',
    // The gradient tile has no one colour, so the browser chrome keeps the
    // app's accent. A manifest cannot read a CSS variable;
    // brand-colour.test.ts fails when this and `--ds-accent` drift.
    theme_color: '#5B45E0',
    icons: [
      { src: '/brand/temply-app-icon-gradient.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
      { src: '/brand/temply-app-icon-gradient-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/brand/temply-app-icon-gradient-512.png', sizes: '512x512', type: 'image/png' },
    ],
  };
}
