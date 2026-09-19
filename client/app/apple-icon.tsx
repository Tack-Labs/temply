import { ImageResponse } from 'next/og';
import { Mark } from './mark';

/** The home-screen icon iOS asks for; without one it screenshots the page. */
export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

export default function AppleIcon() {
  return new ImageResponse(<Mark size={size.width} />, size);
}
