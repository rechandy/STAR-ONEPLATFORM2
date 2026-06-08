# ADR-0004 — Database-per-service with CQRS read models

**Status:** Accepted · **Date:** 2026-06-08

## Context

Services need roster and student data on their hot paths, but a shared database would
recreate a distributed monolith where one schema change breaks everyone and one slow query
degrades all. Yet calling the Roster Graph synchronously on every request adds latency and
cascading-failure risk.

## Decision

Each service owns a **private database** (Aurora PostgreSQL) — no other service may read or
write it. Services maintain **local, read-optimized projections (CQRS read models)** of the
roster/metric data they care about, kept current by subscribing to events from the canonical
services. Synchronous gRPC reads to a canonical service are allowed only for genuinely
fresh, non-hot-path queries.

## Consequences

- **+** Each service's hot path is fast and isolated; no cross-service joins at request time.
- **+** Canonical services can evolve their schemas freely behind event contracts.
- **+** A new/rebuilt read model can be reconstructed by replaying events.
- **−** Data is duplicated across read models and **eventually consistent** — accepted and
  surfaced in UX where freshness matters.
- **−** Requires reconciliation jobs to detect/repair drift between read models and sources.
