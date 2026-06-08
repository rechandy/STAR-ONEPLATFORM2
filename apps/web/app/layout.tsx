import type { Metadata, Viewport } from 'next';
import './globals.css';
import { ServiceWorkerRegister } from '@/components/ServiceWorkerRegister';

export const metadata: Metadata = {
  title: 'STAR OnePlatform',
  description: 'Unified curriculum, progress monitoring, training, and media for STAR Autism Support.',
  applicationName: 'OnePlatform',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'OnePlatform',
  },
};

// Mobile-first / iPad-first: respect safe areas and set the brand theme color.
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#0b5cab',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        {children}
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
