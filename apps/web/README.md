# @oneplatform/web

The OnePlatform web shell — an installable, **mobile-first / iPad-first Progressive Web
App** built with Next.js (App Router). This is the Phase 0 shell; pillar experiences mount
into it over later phases.

## What's wired up

- **Installable PWA**: `app/manifest.ts` → `/manifest.webmanifest`, maskable SVG icon.
- **Service worker** (`public/sw.js`): app-shell precache, network-first navigations with an
  offline fallback, stale-while-revalidate for static assets. Registered in production by
  `components/ServiceWorkerRegister.tsx`.
- **Mobile/iPad ergonomics**: `viewport-fit=cover` + safe-area insets, responsive grid,
  generous touch targets, brand theme color.

> Offline-first **data collection** (IndexedDB outbox + Background Sync) is intentionally
> deferred to Phase 2 (SOLER), per
> [`docs/architecture/04-client-and-mobile-strategy.md`](../../docs/architecture/04-client-and-mobile-strategy.md).
> The SW must never cache authenticated student-PII responses.

## Develop

```bash
pnpm --filter @oneplatform/web dev     # http://localhost:3000
pnpm --filter @oneplatform/web build
```

> The service worker only registers in a production build (`pnpm build && pnpm start`), to
> avoid caching surprises during development.

## Brand note

Colors here are **placeholders**. Replace with STAR's official brand tokens (palette, logo,
type) when available — drive everything from tokens, no hard-coded hex in components.
