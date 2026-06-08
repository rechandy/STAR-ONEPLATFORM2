# @oneplatform/roster-graph

The **Roster Graph** service — the canonical read API over orgs, classes, and enrollments,
and the source of the **access set** the authorization layer consumes. Built from the
golden-path template; data layer is the shared `@oneplatform/database` Prisma schema.

## Endpoints

All endpoints are under `/api` and require tenant context. Staff-scoped endpoints also
require the acting staff identity.

| Method & path | Purpose | Headers |
| --- | --- | --- |
| `GET /api/healthz` | Liveness | — |
| `GET /api/readyz` | Readiness (checks DB) | — |
| `GET /api/roster/my-classes` | Classes the staff teaches/serves | `x-tenant-id`, `x-user-id` |
| `GET /api/roster/my-students` | Distinct students across all the staff's sections | `x-tenant-id`, `x-user-id` |
| `GET /api/roster/my-caseload` | A specialist's related-service caseload | `x-tenant-id`, `x-user-id` |
| `GET /api/roster/students/:id` 🔒 | Protected student detail (profile + goals + objectives) | `x-tenant-id`, `x-user-id` |
| `GET /api/roster/students/:id/access` 🔒 | Full staff **access set** for a student | `x-tenant-id`, `x-user-id` |
| `GET /api/me` | Acting user identity + org memberships (dashboard shell) | `x-tenant-id`, `x-user-id` |
| `GET /api/licenses` | Tenant pillar entitlements (dashboard filtering) | `x-tenant-id` |
| `POST /api/admin/teachers` 🔑 | Provision a teacher | `x-tenant-id`, `x-user-id` |
| `POST /api/admin/students` 🔑 | Provision a student (+ profile) | `x-tenant-id`, `x-user-id` |
| `POST /api/admin/parents` 🔑 | Provision a parent/guardian linked to a student | `x-tenant-id`, `x-user-id` |

🔑 = admin onboarding, authorized by Cedar `manageRoster` on the target school (district
admins anywhere; school admins for their school). Non-admins / wrong-school → **403**.

🔒 = enforced by `StudentAccessGuard` (Cedar `viewStudent`, see `@oneplatform/authz`). Staff
not authorized for the student get **403**; missing `x-user-id` gets **401**. The self-scoped
`my-*` endpoints need no per-student guard — the query itself is the access boundary.

> `x-tenant-id` / `x-user-id` are stand-ins for the verified gateway/IAM claims (blueprint
> §5.1–5.2). They make the multi-tenant + access contracts real from day one.

## Run locally

```bash
# 1) start + seed the database (see packages/database)
pnpm --filter @oneplatform/database db:up
pnpm --filter @oneplatform/database db:migrate
pnpm --filter @oneplatform/database db:seed
pnpm --filter @oneplatform/database db:generate

# 2) run the service
cp services/roster-graph/.env.example services/roster-graph/.env
pnpm --filter @oneplatform/roster-graph dev   # http://localhost:3001
```

## Try it against the seeded demo data

```bash
H='-H x-tenant-id:star-demo'

# A primary teacher's students (across their domain sections + any co-taught/caseload):
curl $H -H x-user-id:T0026 http://localhost:3001/api/roster/my-students

# An SLP's speech-therapy caseload across the schools they serve:
curl $H -H x-user-id:SLP001 http://localhost:3001/api/roster/my-caseload

# The full access set for a student (who can the authorizer allow, and via which classes):
curl $H http://localhost:3001/api/roster/students/S00001/access
```

The access-set response is the direct input to the Cedar/RBAC policy work
([ADR-0005](../../docs/adr/0005-cedar-authorization.md)): assert that a teacher only
appears for their own/ co-taught students, and a specialist only for their caseload.

## Notes / next steps

- Add request validation + pagination for large result sets.
- Add OpenAPI (`@nestjs/swagger`) and gRPC for internal service-to-service reads.
- Replace header stand-ins with the verified gateway tenant/principal claims.
- Maintain a local read model via roster events once the event backbone exists.
