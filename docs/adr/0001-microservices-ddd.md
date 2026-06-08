# ADR-0001 — Microservice architecture with Domain-Driven Design

**Status:** Accepted · **Date:** 2026-06-08

## Context

OnePlatform unifies four distinct products (Links, SOLER, SOLS, Media Center) plus shared
platform capabilities. These have different scaling profiles, release cadences, and team
owners. We need independent deployability and clear ownership without recreating four silos.

## Decision

Adopt a **microservice architecture** decomposed by **Domain-Driven Design** bounded
contexts. Each context maps to one (occasionally two) independently deployable services that
own their data and expose contracts via APIs and events. A shared platform layer provides
the golden-path template, identity, eventing, and observability.

## Consequences

- **+** Independent deploys, clear ownership, fault isolation, targeted scaling.
- **+** New pillars/services slot in via the same contracts and template.
- **−** Operational complexity (distributed systems, eventual consistency) — mitigated by
  the platform team, golden path, and strong observability.
- We accept eventual consistency between services as a core trade-off (see ADR-0003/0004).
- Guardrail: **architecture fitness functions** in CI forbid cross-service database access
  to prevent distributed-monolith creep.
