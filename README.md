# STAR OnePlatform

> A unified curriculum, progress-monitoring, professional-learning, and media
> platform for **STAR Autism Support** — built so that school rosters and student
> metrics flow seamlessly across all four product pillars.

OnePlatform consolidates STAR's four core products into a single, microservice-based
platform powered by a **Unified Data Engine**. Districts sync their rosters once; every
service (curriculum, assessment, training, media) reads from the same canonical source
of truth.

## The four pillars → platform services

| Pillar | What it does | Becomes the… |
| --- | --- | --- |
| **Links Curriculum** | Leveled, research-based curriculum teachers use to instruct autistic students | **Curriculum Service** |
| **SOLER** | Student Outcomes, Lessons, Evaluations & Reports — progress monitoring | **Assessment & Progress-Monitoring Service** |
| **SOLS** (STAR Online Learning System) | Educator training & certification (adult LMS) | **Learning & Certification Service** |
| **Media Center** | Repository of instructional & reference videos | **Media Center + shared Media Service** |

## The thesis

The hard part is **not** the four apps — it is the shared substrate underneath them:
a single canonical model of **organizations → schools → classes → enrollments → users →
students**, plus a unified store of **student outcome metrics**, that every service plugs
into without tight coupling. That substrate is the **Unified Data Engine** (see
[`docs/architecture/02-unified-data-engine.md`](docs/architecture/02-unified-data-engine.md)).

## Documentation map

| Document | Purpose |
| --- | --- |
| [`01-blueprint.md`](docs/architecture/01-blueprint.md) | The foundational architecture: principles, service catalog, tech stack, cross-cutting concerns, diagrams |
| [`02-unified-data-engine.md`](docs/architecture/02-unified-data-engine.md) | Deep dive on the roster + metrics engine (the core challenge) |
| [`04-client-and-mobile-strategy.md`](docs/architecture/04-client-and-mobile-strategy.md) | iPad/tablet/mobile delivery: PWA-first + offline-first data collection |
| [`03-implementation-roadmap.md`](docs/architecture/03-implementation-roadmap.md) | Phased delivery plan, team topology, exit criteria |
| [`docs/adr/`](docs/adr/) | Architecture Decision Records — the "why" behind each major choice |

## Target context (decided)

- **Build mode:** Greenfield rebuild (legacy data imported, not migrated in place)
- **Cloud:** AWS
- **Stack:** Best-fit recommendation (TypeScript/NestJS default + Go data-plane; Next.js web)
- **Roster integration:** OneRoster / Clever / ClassLink as a **first-class, core capability**

## Repository layout (Turborepo monorepo)

```
apps/
  web/                     # Next.js PWA shell (installable, mobile/iPad-first)
services/
  service-template/        # golden-path NestJS service (tenancy, health, config)
packages/
  database/                # canonical OneRoster + outcomes Prisma schema, migrations, seed
  tsconfig/                # shared TS config bases (base / nestjs / nextjs)
infra/
  terraform/               # AWS landing-zone stub
docs/                      # architecture blueprint, data engine, roadmap, ADRs
turbo.json, pnpm-workspace.yaml, eslint.config.mjs   # monorepo tooling
```

## Development (Phase 0)

Prereqs: Node ≥ 20, `pnpm` (via `corepack enable`), Docker (for local Postgres).

```bash
corepack enable
pnpm install

pnpm dev          # run all apps/services (turbo)
pnpm lint         # eslint across the workspace
pnpm typecheck    # tsc --noEmit across the workspace
pnpm build        # build everything

# database (see packages/database/README.md)
pnpm --filter @oneplatform/database db:up
pnpm --filter @oneplatform/database db:migrate
pnpm --filter @oneplatform/database db:seed
```

CI (`.github/workflows/ci.yml`) runs install → prisma generate → lint → typecheck → build → test
on every push/PR.

## Status

🏗️ **Phase 0 (foundations) in progress.** The Unified Data Engine schema + demo seed are in
[`packages/database`](packages/database); the monorepo skeleton (Turborepo, service template,
PWA shell, Terraform stub) is scaffolded. Architecture is documented under [`docs/`](docs/).
