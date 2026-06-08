# Client & Mobile Strategy (iPad / Tablet / Phone)

**Decision:** **PWA-first** — one responsive, mobile-first, touch-optimized web app,
installable as a Progressive Web App, with **offline-first data collection** as a core
capability. Native apps are deferred until clear criteria are met (§9).

This is a deliberate fit for the audience: iPads are ubiquitous in autism/special-education
classrooms, and SOLER progress-monitoring data is captured *in the moment* — often on
unreliable classroom Wi-Fi. The platform must work on a tablet, by touch, even when the
network drops.

---

## 1. Principles

1. **Mobile-first, touch-first.** Design for the smallest/touch target first; scale up to
   desktop. No interaction may depend on hover or right-click.
2. **Offline-first for data collection.** Recording student data must never be blocked by
   connectivity. Capture locally, sync automatically when back online.
3. **One codebase, responsive everywhere.** The Next.js web app + shared design system
   adapt across phone, tablet, and desktop — no separate mobile site.
4. **Installable, app-like.** Add-to-Home-Screen gives a full-screen, icon-launched
   experience without App Store gatekeeping.
5. **Accessible by touch.** WCAG 2.1 AA plus touch-specific guidance (target size, motor
   tolerance, VoiceOver/Switch Control) — non-negotiable for this audience.

---

## 2. Why PWA-first (not native, yet)

| Factor | PWA-first outcome |
| --- | --- |
| Time-to-value | One codebase ships to all devices immediately; no dual native build |
| Distribution | No App Store review cycle; instant updates; deployable as a managed Web Clip via MDM |
| Maintenance | Single web team, shared design system and contracts |
| Capability today | iOS 16.4+ supports installed-PWA **Web Push, badging, and offline**; Service Workers + IndexedDB cover offline data capture |
| District IT | Web Clips push to managed iPads via **Apple School Manager + Jamf/Intune**; managed app config supported |

Native is a **later, evidence-driven** step (§9), not a day-one cost.

---

## 3. PWA architecture

```
┌──────────────────────────────────────────────────────────────┐
│  Browser / Installed PWA (iPad, phone, Chromebook, desktop)   │
│                                                                │
│  Next.js App  ──  Design System (responsive, touch tokens)    │
│        │                                                       │
│        ▼                                                       │
│  Service Worker  (app shell cache, routing, background sync)   │
│        │                                                       │
│        ▼                                                       │
│  Local Store (IndexedDB)                                       │
│   • cached reference data (rosters, curriculum slices)         │
│   • OUTBOX: queued data-collection events (append-only)        │
└───────────────┬───────────────────────────────────────────────┘
                │  HTTPS, delta sync + outbox flush (idempotent)
                ▼
        API Gateway + BFF  ──►  services  ──►  student.metric.v1 events
```

- **App shell + Service Worker:** the shell, fonts, and design system are precached for
  instant, offline-capable loads. Use a vetted toolchain (e.g., Workbox / `next-pwa`-style
  setup) — caching strategy is explicit per resource type.
- **Manifest:** name, STAR icons/maskable icons, theme color, `display: standalone`,
  orientation, scoped start URL for a true app feel.
- **Caching strategy:** app shell = cache-first; reference data = stale-while-revalidate;
  authenticated API reads = network-first with bounded cache; **never** cache sensitive
  student PII beyond policy (§7).

---

## 4. Offline-first data collection (the core capability)

This reuses the platform's event-sourced design at the edge: **the device keeps a local
outbox of immutable metric events**, exactly mirroring the server-side transactional outbox
(ADR-0003). Append-only metrics are ideal for offline because they don't require reading
global state to write.

### Capture → queue → sync

1. **Capture:** teacher records a trial/objective; the app writes a
   `student.metric.v1`-shaped record to the **IndexedDB outbox** with a client-generated
   **idempotency key** (UUID) and `occurredAt` timestamp. The UI confirms instantly.
2. **Queue:** records persist locally; the teacher keeps working fully offline.
3. **Sync:** when connectivity returns, **Background Sync** (or foreground flush) POSTs
   queued records to the BFF. The server **dedupes on the idempotency key**, so retries are
   safe and exactly-once-effect is preserved.
4. **Reconcile:** the server returns canonical ids/acks; the client marks records synced and
   prunes the outbox. Reference read models refresh via delta sync.

### Conflict handling

- Metric capture is **append-only** → conflicts are rare by design (you're adding events,
  not editing shared rows).
- For the few editable entities (e.g., a session note), use **last-write-wins on a version/
  timestamp**, with server authority; surface a gentle "updated elsewhere" notice rather
  than silent overwrite.
- All sync is **idempotent and resumable** — a half-completed flush never duplicates data.

> The full wire protocol — outbox record shape, push/pull payloads, cursor semantics, and
> the retry/backoff state machine — is specified in
> [`05-offline-sync-protocol.md`](05-offline-sync-protocol.md).

### Sync endpoints (BFF)

- `GET /sync/roster?since=<cursor>` and `GET /sync/curriculum?since=<cursor>` — **delta
  pulls** keep the on-device reference data small and current.
- `POST /sync/metrics` — **batched outbox flush** with idempotency keys.
- Cursors + ETags keep payloads small for mobile networks.

---

## 5. iPad & tablet specifics

- **Touch targets** ≥ 44×44pt (Apple HIG) / WCAG 2.5.5; generous spacing for motor
  differences common in the user population.
- **No hover dependency**; provide explicit controls; large, forgiving hit areas.
- **Gestures & input:** support on-screen keyboard insets, Apple Pencil where it helps
  (e.g., signatures/notes), and avoid gestures that conflict with iPadOS system swipes.
- **Viewport & safe areas:** respect notches/home indicator via `viewport-fit=cover` and
  `env(safe-area-inset-*)`; lock sensible orientations per screen.
- **AAC / assistive context:** classrooms often run AAC and Switch Control — ensure the app
  cooperates with VoiceOver and Switch Control focus order.
- **Shared-device reality:** fast user switching, visible "who's signed in," short idle
  timeouts, and quick re-auth (§7).

---

## 6. District deployment on managed iPads (MDM)

- Distribute as a **managed Web Clip** pushed via **Apple School Manager + Jamf School /
  Microsoft Intune**; supports a branded home-screen icon and full-screen launch.
- Support **managed app configuration** (e.g., pre-set district/tenant, SSO hints) so IT can
  zero-touch provision.
- Compatible with **Single-App / Kiosk (Guided Access)** modes used for student-facing use.
- Same approach covers managed **Chromebooks** (district-pushed PWA), which dominate many
  K-12 fleets alongside iPads.

---

## 7. Security on shared & mobile devices

- **Short, configurable session timeouts** and quick SSO re-auth; never persist long-lived
  tokens on shared hardware.
- **Encrypted local store**; cache only the **minimum** roster/curriculum data needed for
  offline work, with a **tenant-policy-driven retention/auto-purge** on sign-out or after N
  days.
- **Remote sign-out / device revocation** invalidates sessions and triggers local cache
  wipe on next contact.
- Honor the platform's data-minimization and FERPA/COPPA posture on the client exactly as on
  the server — the device is in scope for compliance.

---

## 8. Performance, notifications & testing

- **Performance budgets** for mobile: strict JS/CSS budgets, route-level code splitting,
  image optimization, lazy-loaded media; target good Core Web Vitals on mid-tier tablets and
  3G-class networks.
- **Web Push** (installed PWA, iOS 16.4+) for assignment reminders, certification expiry, and
  sync-failure alerts — routed through the Notifications service.
- **Testing:** real-device lab (iPad models + common Android/Chromebook), automated
  responsive/visual regression, offline/airplane-mode test suites for the sync flow, and
  a11y testing with VoiceOver/Switch Control.

---

## 9. When to graduate to native (criteria, not now)

Revisit native (likely **React Native**, reusing TypeScript skills and design tokens) only
if one of these becomes a hard requirement:

- Deep device integration the web can't reach (advanced background processing, specific
  Bluetooth/peripheral hardware, certain camera/sensor workflows).
- App-Store presence is a district procurement requirement.
- Measured performance/offline limits on target iPads block the data-collection workflow.

Until then, PWA-first delivers the iPad/mobile requirement with one codebase.

---

## 10. Roadmap impact

- **Phase 0:** PWA scaffolding (manifest, service worker, install), responsive/touch tokens
  and a11y harness in the design system, mobile performance budgets in CI.
- **Phase 1:** delta-sync endpoints on the BFF; on-device reference-data store.
- **Phase 2 (SOLER):** **offline-first data collection** built and validated on real iPads —
  this is where the offline requirement is proven end-to-end.
- **Phase 5:** MDM/Web Clip deployment hardening, device-fleet performance, security review of
  on-device data handling.
