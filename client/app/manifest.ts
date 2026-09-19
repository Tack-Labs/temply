import type { MetadataRoute } from 'next';
import { MARK_INDIGO } from './mark';

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
    theme_color: MARK_INDIGO,
    icons: [
      { src: '/brand/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
      { src: '/icon-192', sizes: '192x192', type: 'image/png' },
      { src: '/icon-512', sizes: '512x512', type: 'image/png' },
    ],
  };
}
