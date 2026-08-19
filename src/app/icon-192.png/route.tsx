import { ImageResponse } from 'next/og';
import { Mark } from '../icon';

export const dynamic = 'force-static';

export function GET() {
  return new ImageResponse(<Mark size={192} />, { width: 192, height: 192 });
}
