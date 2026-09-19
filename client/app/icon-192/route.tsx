import { ImageResponse } from 'next/og';
import { Mark } from '../mark';

/** The 192px icon a manifest lists, drawn from the same mark as the rest. */
export const dynamic = 'force-static';

export function GET() {
  return new ImageResponse(<Mark size={192} />, { width: 192, height: 192 });
}
