import type { MetadataRoute } from 'next';

// Web App Manifest (Next metadata route -> /manifest.webmanifest).
// Brand colors are placeholders pending STAR's official brand guidelines.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'STAR OnePlatform',
    short_name: 'OnePlatform',
    description: 'Unified curriculum, progress monitoring, training, and media for STAR Autism Support.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'any',
    background_color: '#ffffff',
    theme_color: '#0b5cab',
    icons: [
      { src: '/icons/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
      { src: '/icons/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'maskable' },
    ],
  };
}
