import { ImageResponse } from 'next/og';
import { Mark } from '../icon';

export const dynamic = 'force-static';

export function GET() {
  return new ImageResponse(<Mark size={512} />, { width: 512, height: 512 });
}
