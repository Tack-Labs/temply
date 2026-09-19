import { ImageResponse } from 'next/og';
import { Mark } from '../mark';

/** The 512px icon a manifest lists, drawn from the same mark as the rest. */
export const dynamic = 'force-static';

export function GET() {
  return new ImageResponse(<Mark size={512} />, { width: 512, height: 512 });
}
