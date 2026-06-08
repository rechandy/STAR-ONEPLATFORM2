# @oneplatform/authz

Cedar authorization policies and evaluation helpers for OnePlatform student access
(see [ADR-0005](../../docs/adr/0005-cedar-authorization.md)). Policies are **default-deny**;
access is granted only by an explicit `permit`.

## Model

- **Principal** `Staff` — `tenant`, `role`, `classes` (enrolled non-student classes),
  `schools` (administered).
- **Resource** `Student` — `tenant`, `classes`, `school`.
- **Actions** — `viewStudent`, `recordStudentData`.

## Policies (`cedar/policies.cedar`)

1. **Shared-class view** — any staff sharing a class with the student may *view* them.
   This is what makes cross-teacher access (co-teachers + SLP/OT/BCBA) work.
2. **Record data** — narrower: shared class **and** an instructional role
   (`TEACHER`/`SPECIALIST`/`AIDE`); admins get no data-entry from admin rules.
3. **District admin** — may view any student in their tenant.
4. **School admin** — may view students in a school they administer.

Tenant is checked first in every rule, so identical class ids in a different tenant are
denied (default-deny + no cross-tenant permit).

## Usage

```ts
import { can, authorizedStaff } from '@oneplatform/authz';

can(teacher, 'viewStudent', student); // boolean
authorizedStaff(candidateStaff, 'viewStudent', student); // string[] of staff ids
```

The `StaffEntityInput` / `StudentEntityInput` shapes map 1:1 to roster-graph output, so the
**access set** from `GET /api/roster/students/:id/access` can be fed straight into Cedar.
`authorizedStaff(...)` is the authorization-layer equivalent of that endpoint and the two
must agree.

## Test

```bash
pnpm --filter @oneplatform/authz test
```

The suite encodes the verified S00001 scenario (Meadowbrook): it asserts the primary
teacher, a co-teacher, and the SLP/OT/BCBA are allowed; a specialist covering other schools,
an unrelated teacher, and cross-tenant staff are denied; admin overrides behave; and
`recordStudentData` excludes admins. It also asserts the authorized staff set equals the
roster access set.

## Production note

These same `.cedar` policies deploy to **Amazon Verified Permissions**; this package keeps
them version-controlled and continuously tested against representative roster data.
