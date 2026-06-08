# @oneplatform/database

The canonical **OneRoster + outcomes** data model for STAR OnePlatform, as a Prisma schema
for PostgreSQL, plus a seed that ingests the demo datasets (1,000 students, 40 teachers,
10 administrators, 4,267 IEP goals with progress metrics).

This is the **Unified Data Engine's reference schema** in one database for local dev. In
production these modules split across service-owned databases (see
[`docs/adr/0004`](../../docs/adr/0004-db-per-service-cqrs.md)); the module comments in
`prisma/schema.prisma` map each model to its owning service.

## What the schema models

| Module | Models | Owning service |
| --- | --- | --- |
| Tenancy | `Tenant`, `Org` (district→school), `AcademicSession` | Roster Graph |
| Identity | `User`, `UserIdentifier`, `OrgMembership` | IAM + Roster Graph |
| Roster | `Course`, `Class` (section), `Enrollment` | Roster Graph |
| Student | `StudentProfile` | Student Record |
| IEP (Links↔SOLER bridge) | `IepGoal` | Curriculum + Assessment |
| Outcomes | `GoalProgress`, `MetricEvent` (canonical, append-only) | Student Record / SOLER |
| SOLS (extension) | `Certification` | Learning & Certification |
| Media (extension) | `MediaEngagement` | Media Center |

**Multi-tenant:** every row carries `tenant_id`; `prisma/rls.sql` adds PostgreSQL
Row-Level Security so isolation is enforced at the database, not just in app code.

**Usable by all four pillars:** rosters/identities are shared; IEP goals feed Links
(curriculum) and SOLER (assessment); the append-only `MetricEvent` store is the one shape
every pillar (and the reporting lakehouse) reads and writes.

**Many-to-many roster:** `Enrollment` is the User↔Class join, so a **teacher runs many
sections** and a **student is rostered into many classes** — both directions are first-class.
A `Class` is a *section*; in the seed each section is a `(teacher × instructional domain)`
class that is a section of the per-domain Links `Course`. A student with goals in several
domains is therefore enrolled in several classes.

## Quick start

```bash
# from packages/database
cp .env.example .env
pnpm install            # or npm install

pnpm db:up              # start local Postgres (Docker)
pnpm db:migrate         # create schema (prisma migrate dev)
psql "$DATABASE_URL" -f prisma/rls.sql   # (optional) enable RLS policies
pnpm db:seed            # ingest demo_users.json + star_iep_dataset.csv
pnpm db:studio          # browse the data
```

Expected seed summary (verified against PostgreSQL):

```
orgs: 15            (1 district + 14 schools)
courses: 5          (one Links course per instructional domain)
users: 1050         (1000 students + 40 teachers + 10 admins)
classes (sections): 200    (teacher × domain)
enrollments: 4467   (200 teacher + 4267 student)
studentProfiles: 1000
iepGoals: 4267
goalProgress: 4267
metricEvents: 6308  (4267 ACCURACY_SNAPSHOT + 2041 OBJECTIVE_MASTERED)
M:N check → a student is rostered in up to 5 classes; a teacher runs up to 5 sections.
```

The seed is **idempotent** (deterministic ids + `skipDuplicates`) — safe to re-run.

## How the raw files map in

- `data/demo_users.json` → `User` (TEACHER/ADMINISTRATOR) + `OrgMembership` to their school.
- `data/star_iep_dataset.csv`:
  - distinct `student_id` → `User` (STUDENT) + `StudentProfile` (age/grade/diagnosis)
  - each row → `IepGoal` (+ `GoalProgress` snapshot) and one or two canonical `MetricEvent`s
  - **synthesized many-to-many roster:** one `Course` per domain; one `Class` *section* per
    `(teacher × domain)`; the teacher is enrolled in each of their sections, and each student
    is enrolled in **every section they have a goal in** — so teachers run many sections and
    students belong to many classes. All under the 2025–2026 `AcademicSession`.

## Example cross-pillar queries

```ts
// "My students" across ALL of a teacher's sections (M:N) — used by every pillar
prisma.enrollment.findMany({
  where: { tenantId, class: { is: { /* teacher's sections */ } }, role: 'STUDENT' },
  include: { user: { include: { studentProfile: true } }, class: true },
});

// All classes a single student is rostered into (M:N the other direction)
prisma.enrollment.findMany({
  where: { tenantId, userId: 'S00001', role: 'STUDENT' },
  include: { class: { include: { course: true } } },
});

// One teacher's Communication section roster (section id = class-<teacher>-<domaincode>)
prisma.enrollment.findMany({
  where: { tenantId, classId: 'class-T0026-comm', role: 'STUDENT' },
  include: { user: { include: { studentProfile: true } } },
});

// SOLER: goals due for review with current accuracy
prisma.iepGoal.findMany({
  where: { tenantId, status: 'ACTIVE' },
  include: { progress: true, student: { include: { user: true } } },
  orderBy: { daysRemainingToReview: 'asc' },
});

// Unified outcomes feed (what Reporting / lakehouse consume)
prisma.metricEvent.findMany({ where: { tenantId, metricType: 'OBJECTIVE_MASTERED' } });
```
