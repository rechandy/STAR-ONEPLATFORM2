# Architecture Decision Records (ADRs)

ADRs capture the **context, decision, and consequences** of significant architectural
choices. They are immutable once accepted; to change a decision, write a new ADR that
supersedes the old one.

Format: [Michael Nygard's ADR template](https://github.com/joelparkerhenderson/architecture-decision-record).

| # | Decision | Status |
| --- | --- | --- |
| [0001](0001-microservices-ddd.md) | Microservice architecture with Domain-Driven Design | Accepted |
| [0002](0002-oneroster-canonical-model.md) | OneRoster as the canonical roster data model | Accepted |
| [0003](0003-event-backbone-outbox.md) | Event backbone (Kafka) with the transactional outbox pattern | Accepted |
| [0004](0004-db-per-service-cqrs.md) | Database-per-service with CQRS read models | Accepted |
| [0005](0005-cedar-authorization.md) | Centralized fine-grained authorization with Cedar | Accepted |
| [0006](0006-polyglot-stack-boundaries.md) | Constrained polyglot: TypeScript default, Go data-plane | Accepted |
