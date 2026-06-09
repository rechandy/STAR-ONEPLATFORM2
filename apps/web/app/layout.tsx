import type { Metadata, Viewport } from 'next';
import Link from 'next/link';
import './globals.css';
import { ServiceWorkerRegister } from '@/components/ServiceWorkerRegister';
import { SignOutButton } from '@/components/SignOutButton';
import { getSession } from '@/lib/auth/session';

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
  const session = getSession();
  return (
    <html lang="en">
      <body>
        <header className="appbar">
          <Link href="/" className="appbar-brand">
            <span className="brand-star" aria-hidden>
              ★
            </span>
            OnePlatform
          </Link>
          <nav className="appbar-nav">
            {session ? (
              <>
                <Link href="/dashboard">Dashboard</Link>
                <SignOutButton />
              </>
            ) : (
              <Link href="/login">Sign in</Link>
            )}
          </nav>
        </header>
        {children}
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
