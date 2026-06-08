# ADR-0003 — Event backbone (Kafka) with the transactional outbox pattern

**Status:** Accepted · **Date:** 2026-06-08

## Context

Roster changes and student metrics must propagate to all four services without tight
coupling or synchronous fan-out. We also must avoid the classic **dual-write** bug, where a
service commits to its database but fails to publish the corresponding event (or vice
versa), leaving systems inconsistent.

## Decision

Use **Apache Kafka (Amazon MSK)** as the platform event backbone with a **Schema Registry**
(Avro/Protobuf, enforced backward compatibility). Services publish state changes via the
**transactional outbox pattern**: the domain change and an outbox row are written in one DB
transaction, and **Debezium CDC** reliably relays outbox rows to Kafka.

## Consequences

- **+** Atomicity between state change and event — no lost or phantom events.
- **+** Loose coupling: producers don't know consumers; new consumers replay history.
- **+** Schema Registry makes contracts explicit and evolvable.
- **−** Operational overhead of Kafka, Debezium, and registry — owned by the platform team.
- **−** Consumers must be **idempotent** and tolerate out-of-order, eventual delivery;
  enforced via a shared consumer library with dedupe and dead-letter handling.
