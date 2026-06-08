# ADR-0006 — Constrained polyglot: TypeScript default, Go data-plane

**Status:** Accepted · **Date:** 2026-06-08

## Context

The platform has two distinct workload profiles: product/experience services (CRUD, UI-
facing, rapid iteration) and data-plane services (roster sync, identity matching, high-
throughput event/metric processing). One language rarely excels at both, but unbounded
polyglot explodes operational and hiring cost.

## Decision

Constrain the platform to **two backend languages**:

- **TypeScript + NestJS** is the **default** for product/experience services and the BFF —
  shared types with the Next.js web app, large hiring pool, fast iteration.
- **Go** is used for **data-plane / high-throughput** services (Roster Sync, identity
  matching, event processors) where predictable latency and concurrency matter.

The web frontend is **Next.js (React) + TypeScript**. New languages require a new ADR.

## Consequences

- **+** Right tool for each workload without sprawl; shared TS types reduce frontend/backend
  drift.
- **+** Bounded operational surface: two runtimes to secure, observe, and patch.
- **−** Two ecosystems for shared libraries (logging, tracing, outbox) — mitigated by
  generating clients from the same Protobuf/OpenAPI contracts and providing both TS and Go
  platform SDKs.
- **−** Some duplicated platform tooling — accepted cost for workload fit.
