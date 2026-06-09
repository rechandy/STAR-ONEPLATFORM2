# @oneplatform/links — Curriculum (Links)

The Links pillar: the **scope & sequence**, lessons, and **assignment of
curriculum** to classes/students. Links is the consumer half of the Phase 2
teacher loop — it subscribes to **`student.metric.v1`** and *adapts instruction*,
advancing a curriculum assignment to MASTERED when SOLER reports the objective
mastered (mapped through the `IepGoal → CurriculumObjective` bridge).

## Domain

- **Lesson** — a delivery routine for a `CurriculumObjective`; `steps` holds the
  ordered instructional steps + materials.
- **CurriculumAssignment** — an objective (optionally a lesson) assigned to a
  class OR a student. `status` / `lastAccuracy` are advanced by the metric
  consumer; this is Links' own read model (CQRS, ADR-0004).

Per ADR-0004, assignment targets (class/student) are referenced by id only — no
cross-aggregate FKs.

## API (prefix `/api`)

| Method | Route | Purpose |
| --- | --- | --- |
| GET | `/curriculum/scope-sequence?domain=` | Objectives ordered by domain/sequence, with lesson counts. |
| GET | `/curriculum/objectives/:id` | One objective + its ordered lessons. |
| POST | `/assignments` | Assign an objective (±lesson) to a class or student. |
| GET | `/students/:studentId/assignments` | A student's curriculum (direct + via classes). Cedar `viewStudent`. |
| GET | `/classes/:classId/assignments` | A class's curriculum. |
| GET | `/healthz`, `/readyz` | Liveness / readiness. |

Assignment auth: student targets use Cedar `recordStudentData`; class targets
require teaching the section or administering its school. Requests carry
`x-tenant-id` and `x-user-id`.

## Adapt-instruction consumer

`CurriculumProjector` subscribes to `student.metric.v1`. With the in-memory
broker it only sees events from this process; set `EVENT_BROKER=kafka` to
consume metrics SOLER/Student Record produce elsewhere (ADR-0003).

## Run

```bash
pnpm --filter @oneplatform/database db:up
pnpm --filter @oneplatform/database db:migrate    # applies add_links_curriculum
pnpm --filter @oneplatform/database db:seed
cp services/links/.env.example services/links/.env
pnpm --filter @oneplatform/links dev              # :3004
```
