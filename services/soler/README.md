# @oneplatform/soler — Assessment & Progress-Monitoring (SOLER)

The SOLER pillar: **trial-by-trial data collection** against IEP goals. Teachers
run data-collection sessions (often offline on an iPad); on finalize SOLER
computes accuracy/mastery and emits the canonical **`student.metric.v1`** event
through the transactional outbox (ADR-0003), so Student Record and Reporting
update with **zero re-entry** — the Phase 2 teacher loop.

## Domain

- **DataCollectionSession** — a session against a goal/domain; holds the prompt
  level, mastery target, and (on finalize) the computed accuracy + mastery flag.
- **Trial** — one discrete-trial datapoint (`correct`, `promptLevel`), keyed by
  the offline client `opId` for exactly-once sync.

Per ADR-0004 these tables carry no cross-aggregate FKs; student/goal/class/staff
are referenced by id (like `MetricEvent.studentId`). In production SOLER owns its
own database fed by roster events.

## API (prefix `/api`)

| Method | Route | Purpose |
| --- | --- | --- |
| POST | `/sync/mutations` | Offline batch: `session/create`, `trial/create`, `session/finalize`. Idempotent per `opId`; Cedar `recordStudentData` per op. |
| GET | `/students/:studentId/sessions` | A student's sessions (cursor-paginated). Cedar `viewStudent`. |
| GET | `/sessions/:sessionId` | Mastery report + trial-by-trial accuracy curve. |
| GET | `/healthz`, `/readyz` | Liveness / readiness. |

Requests carry `x-tenant-id` and `x-user-id` (IAM stand-ins, as elsewhere).

## Run

```bash
pnpm --filter @oneplatform/database db:up        # Postgres
pnpm --filter @oneplatform/database db:migrate    # applies add_soler_sessions
pnpm --filter @oneplatform/database db:seed
cp services/soler/.env.example services/soler/.env
pnpm --filter @oneplatform/soler dev              # :3003
```

On finalize the outbox relay publishes `student.metric.v1` to the backbone
(in-memory by default; set `EVENT_BROKER=kafka` to use MSK — ADR-0003).
