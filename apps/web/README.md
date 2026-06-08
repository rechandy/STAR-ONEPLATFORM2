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

- **Offline-first outbox** (`lib/sync/`): an IndexedDB-backed outbox + flush engine wired to
  `POST /sync/mutations` per
  [`docs/architecture/05-offline-sync-protocol.md`](../../docs/architecture/05-offline-sync-protocol.md).
  Captures are durable immediately; `flush()` posts batches, removes `applied`/`duplicate`,
  parks `rejected` as `needs_attention`, and keeps the queue with full-jitter backoff on
  offline/5xx/401. Auto-flushes on the browser `online` event. The `OutboxDemo` component
  on the home page exercises it. Core engine is unit-tested (`pnpm --filter @oneplatform/web test`).

- **BFF** (`app/api/sync/mutations/route.ts`): a same-origin route handler the outbox flushes
  to; it forwards to the **student-record** service (`STUDENT_RECORD_URL`), injecting the
  tenant + acting-staff identity **server-side** (production: from the verified session, not
  the client). This makes the offline→online round-trip real without CORS.

> The service worker must never cache authenticated student-PII responses.

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
