# @oneplatform/student-record

The Student Record & Outcomes service. It owns the **append-only `MetricEvent`** store and
ingests offline-captured outcomes through the sync protocol, with **every write authorized
by Cedar** before it persists. It serves four outcome families:

| Category | Metric types | Example payload |
| --- | --- | --- |
| **progress** | `TRIAL_SCORE`, `ACCURACY_SNAPSHOT`, `PROMPT_LEVEL_CHANGE` | `{ trials, correct, promptLevel }` |
| **milestone** | `MILESTONE_ACHIEVED`, `OBJECTIVE_MASTERED` | `{ title }` (+ `goalId`) |
| **assessment** | `ASSESSMENT_SCORED` | `{ instrument, score }` |
| **behavior** | `BEHAVIOR_INCIDENT`, `BEHAVIOR_OBSERVATION` | `{ behavior, antecedent?, consequence?, intensity? }` |

Each family has a validated `value` shape (`src/outcomes/taxonomy.ts`); invalid payloads are
`rejected: invalid`.

## Endpoints

### Write (offline sync)

```
POST /api/sync/mutations
```

Batched outbox flush from the offline client (see
[`docs/architecture/05-offline-sync-protocol.md`](../../docs/architecture/05-offline-sync-protocol.md)).
Headers: `x-tenant-id`, `x-user-id` (acting staff). Missing staff identity → **401**.

**Request**

```jsonc
{
  "deviceId": "ipad-7a3f",
  "mutations": [
    {
      "opId": "0f9c1c8e-…",          // UUID == MetricEvent.idempotencyKey
      "collection": "metricEvent",
      "op": "create",
      "payload": {
        "studentId": "S00001",
        "goalId": "G00001",
        "classId": "class-T0026-comm",
        "source": "SOLER",
        "metricType": "TRIAL_SCORE",
        "value": { "trials": 10, "correct": 9, "promptLevel": 2 },
        "occurredAt": "2026-06-08T14:03:00.000Z"
      }
    }
  ]
}
```

**Response** — one result per `opId`:

```jsonc
{
  "serverTime": "…",
  "results": [{ "opId": "0f9c1c8e-…", "status": "applied", "serverId": "…" }]
}
```

| status | meaning |
| --- | --- |
| `applied` | persisted now |
| `duplicate` | `opId` already applied (safe retry) |
| `rejected` | `error.code`: `forbidden` (authz), `invalid`, `unsupported`, `internal` |

### Read (protected by Cedar `viewStudent` via `StudentAccessGuard`)

```
GET /api/students/:studentId/outcomes?category=&type=&limit=&cursor=   # cursor-paginated log
GET /api/students/:studentId/summary                                    # aggregated snapshot
```

`category` ∈ `progress | milestone | assessment | behavior`. Unauthorized staff → **403**,
missing identity → **401**. The summary returns counts by category plus
`milestonesAchieved`, `behaviorIncidents`, `assessmentsLogged`, and `lastAssessment`.

## Enforcement

Each mutation is authorized individually via `@oneplatform/authz` with the
**`recordStudentData`** action — shared class **and** an instructional role. Admins can
*view* students (roster-graph) but **cannot record data** here. Cross-tenant and
unrelated-staff writes are denied (`rejected: forbidden`). This is the same Cedar policy
roster-graph enforces, applied per-item because a batch spans many students.

## Idempotency

`opId` maps to `MetricEvent.idempotencyKey` (unique per tenant). A replayed batch returns
`duplicate` for already-applied ops — exactly-once effect end-to-end.

## Run locally

```bash
pnpm --filter @oneplatform/database db:up
pnpm --filter @oneplatform/database db:migrate
pnpm --filter @oneplatform/database db:seed
pnpm --filter @oneplatform/database db:generate
cp services/student-record/.env.example services/student-record/.env
pnpm --filter @oneplatform/student-record dev   # http://localhost:3002
```

## Events (transactional outbox — ADR-0003)

Every applied metric writes an `OutboxEvent` (`student.metric.v1`) **in the same
transaction** as the `MetricEvent` — no dual-write. A background **relay**
(`src/messaging/outbox-relay.service.ts`) publishes PENDING rows to the broker and marks
them PUBLISHED; failures back off and land in FAILED after retries.

The broker is selected by `EVENT_BROKER` (`memory` default, or `kafka`). With
`EVENT_BROKER=kafka` + `KAFKA_BROKERS`, `EventBackbone` binds to Kafka/MSK via kafkajs
(start a local broker with `infra/kafka/docker-compose.yml`). The relay/consumers depend
only on the `Broker` interface. A demonstration consumer
(`ReportingProjector`) maintains the `OutcomeRollup` read model, showing events propagate
into a projection; in production **SOLER, Links, and Reporting** each subscribe to
`student.metric` for their own read models.

```
POST /sync/mutations ──tx──> MetricEvent + OutboxEvent
                                   │ relay (poll)
                                   ▼
                              Broker (Kafka in prod) ──► SOLER / Links / Reporting
```

## Next steps

- Bind the broker to Kafka/MSK (swap `brokerProvider`); or use Debezium CDC on the outbox.
- Replace the co-located roster reads in `AuthzService` with a local roster read model fed
  by roster events.
- Add `GET /api/sync/changes` for outcome pulls if a device needs to read back metrics.
