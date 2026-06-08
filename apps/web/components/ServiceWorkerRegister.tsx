'use client';

import { useEffect } from 'react';

/**
 * Registers the service worker that powers offline support. The SW itself lives
 * at /public/sw.js. Offline-first data collection (IndexedDB outbox + background
 * sync) is built on top of this in Phase 2 — see
 * docs/architecture/04-client-and-mobile-strategy.md.
 */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return;
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;

    const onLoad = () => {
      navigator.serviceWorker.register('/sw.js').catch((err) => {
        console.error('Service worker registration failed:', err);
      });
    };
    window.addEventListener('load', onLoad);
    return () => window.removeEventListener('load', onLoad);
  }, []);

  return null;
}
