import { ImageResponse } from 'next/og';
import { Mark } from './mark';

/**
 * The favicon as a PNG. icon0.svg beside it is what Chrome and Firefox
 * take; Safari ignores SVG favicons and showed nothing in the tab at all.
 * Rendered at build from the same mark, so the two cannot drift. The
 * numbers are Next's way of linking more than one icon — a plain icon.svg
 * and icon.tsx shadow each other and only one reaches the page.
 */
export const size = { width: 32, height: 32 };
export const contentType = 'image/png';

export default function Icon() {
  return new ImageResponse(<Mark size={size.width} />, size);
}
