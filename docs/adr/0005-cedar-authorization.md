# ADR-0005 — Centralized fine-grained authorization with Cedar

**Status:** Accepted · **Date:** 2026-06-08

## Context

Authorization in K-12 is relationship- and scope-based: a teacher may act only on *their*
classes/students; a school admin only within *their* school; a district admin within *their*
org; STAR support staff under controlled conditions. Encoding this ad hoc in each service
guarantees inconsistency and audit gaps. Authentication (Cognito/SSO) is separate from
authorization.

## Decision

Separate **authentication** (Amazon Cognito + Clever/ClassLink/SAML/LTI federation) from
**authorization**. Centralize fine-grained authorization on the **Cedar policy language**
via **Amazon Verified Permissions**. Policies are versioned, tested, and evaluate
"can principal P perform action A on resource R within scope S?" using the roster graph for
relationships.

## Consequences

- **+** One consistent, auditable, testable authorization model across all services.
- **+** Policies evolve without redeploying services; decisions are explainable for audits.
- **+** Relationship-aware scoping maps naturally to the OneRoster graph.
- **−** Requires distributing/caching the relationship data Cedar needs at decision time.
- **−** A shared authorization dependency — mitigated by local caching and graceful
  degradation, and by keeping policy evaluation fast and side-effect-free.
