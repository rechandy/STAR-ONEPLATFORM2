# @oneplatform/student-record

The Student Record & Outcomes service. It owns the **append-only `MetricEvent`** store and
ingests offline-captured outcomes through the sync protocol, with **every write authorized
by Cedar** before it persists.

## Endpoint

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

## Next steps

- Emit a `student.metric.v1` domain event via the transactional outbox once the event
  backbone exists (so SOLER/Links/Reporting consume it).
- Replace the co-located roster reads in `AuthzService` with a local roster read model fed
  by roster events.
- Add `GET /api/sync/changes` for outcome pulls if a device needs to read back metrics.
