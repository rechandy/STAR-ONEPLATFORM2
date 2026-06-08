# @oneplatform/events

Versioned **event contracts** (the schema registry) and the **broker abstraction** for the
OnePlatform event backbone ([ADR-0003](../../docs/adr/0003-event-backbone-outbox.md)).

## Contracts

- `EventEnvelope<T>` — the wrapper every domain event ships in (`id`, `type`, `tenantId`,
  `aggregateType/Id`, `occurredAt`, `schemaVersion`, `payload`).
- `student.metric.v1` (`StudentMetricV1`) — emitted on every recorded student outcome;
  consumed by **SOLER**, **Links**, and **Reporting**.
- `validatePayload(type, payload)` / `validateEnvelope(env)` — ajv-backed schema validation
  (the registry); enforces contracts at publish and consume time.
- `topicForType("student.metric.v1") === "student.metric"` — version-stripped topic
  (a Kafka topic in production).

## Broker

```ts
interface Broker {
  publish(env: EventEnvelope): Promise<void>;
  subscribe(topic: string, handler: EventHandler): () => void;
}
```

- `InMemoryBroker` backs dev/tests (in-process fan-out).
- Production binds this to **Kafka/MSK**; the relay and consumers depend only on the
  interface, so the swap is configuration, not code.
- `idempotent(handler)` dedupes by `env.id` for at-least-once safety.

## How a pillar consumes (e.g. Reporting)

```ts
broker.subscribe('student.metric', idempotent(async (env) => {
  const { valid } = validateEnvelope(env);
  if (!valid) return; // dead-letter in production
  await projectStudentMetric(env.payload as StudentMetricV1);
}));
```

## Test

```bash
pnpm --filter @oneplatform/events test
```
