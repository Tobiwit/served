import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { AuthProvider } from '@/lib/auth/AuthProvider';
import { AuthGate } from '@/components/auth/AuthGate';
import { DataProvider } from '@/lib/store/DataProvider';
import { ExploreProvider } from '@/lib/store/ExploreProvider';
import { ServiceWorker } from '@/components/shell/ServiceWorker';
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
  // Next emits the modern `mobile-web-app-capable`; iOS still wants the legacy
  // name to launch chromeless from the Home Screen on older versions
  other: { 'apple-mobile-web-app-capable': 'yes' },
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
          <ServiceWorker />
          {/* the gate wraps the providers, not just the screens: without a session
              there is nothing to load, and a pull would only come back empty */}
          <AuthProvider>
            <AuthGate>
              <DataProvider>
                <ExploreProvider>
                  {children}
                  <TabBar />
                </ExploreProvider>
              </DataProvider>
            </AuthGate>
          </AuthProvider>
        </MotionConfig>
      </body>
    </html>
  );
}
