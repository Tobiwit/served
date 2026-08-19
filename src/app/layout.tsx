import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { DataProvider } from '@/lib/store/DataProvider';
import { ExploreProvider } from '@/lib/store/ExploreProvider';
import { TabBar } from '@/components/shell/TabBar';
import { MotionConfig } from 'motion/react';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Served',
  description: 'A private instrument for deciding what to cook.',
  manifest: '/manifest.webmanifest',
  applicationName: 'Served',
  appleWebApp: { capable: true, statusBarStyle: 'default', title: 'Served' },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  themeColor: '#ececed',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body>
        <MotionConfig reducedMotion="user">
          <DataProvider>
            <ExploreProvider>
              {children}
              <TabBar />
            </ExploreProvider>
          </DataProvider>
        </MotionConfig>
      </body>
    </html>
  );
}
