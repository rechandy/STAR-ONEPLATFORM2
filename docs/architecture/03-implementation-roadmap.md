# Implementation Roadmap

A phased plan to build OnePlatform without a big-bang launch. Each phase has **concrete
deliverables** and **exit criteria** — you do not start the next phase until the current
one's exit criteria are green. Sequencing is deliberate: **the Unified Data Engine comes
before any pillar**, because every pillar depends on it.

> Durations are planning estimates for a small set of teams, not commitments. Calibrate
> after Phase 0 when velocity is known.

---

## Guiding sequencing logic

1. **Foundations before features.** Platform, security, and developer experience first, so
   every later service inherits them.
2. **Data engine before pillars.** Rosters + metrics + events are the spine.
3. **Prove the thesis with one vertical slice** (the teacher loop) before scaling out.
4. **Highest-coupling pillars first.** SOLER (metrics producer) and Links (roster + metrics
   consumer) validate the engine; SOLS and Media Center follow.
5. **Compliance hardening is continuous**, with a dedicated certification push near GA.

---

## Phase 0 — Foundations & developer experience  *(~6–8 weeks)*

**Goal:** any team can ship a secure, observable, contract-first service on day one.

Deliverables:
- Monorepo (Turborepo/Nx + pnpm); branch, PR, and CODEOWNERS conventions.
- **Golden-path service template** (NestJS + Go variants) with built-in: tenancy context,
  authn/authz hooks, OpenTelemetry, health/SLO endpoints, outbox scaffolding, CI.
- AWS landing zone via **Terraform**: VPC, EKS, ECR, Aurora, MSK, S3, KMS, Secrets Manager;
  `dev` / `staging` / `prod` environments.
- CI/CD: GitHub Actions → ECR → **Argo CD** (GitOps); preview environments.
- Observability baseline: Managed Prometheus/Grafana, tracing, logging, Sentry.
- Security guardrails: image signing, SBOM, dependency + IaC scanning, secret scanning.
- **Design-system skeleton** with brand-token placeholders (wire real STAR tokens when
  delivered) and an a11y test harness (axe).
- ADR process live; ADRs 0001–0006 ratified.

**Exit criteria:** a "hello-service" goes from commit → prod via the template with
tracing, an event published through the outbox, RLS-enforced tenancy, and a passing a11y/
security gate — no manual steps.

---

## Phase 1 — Unified Data Engine MVP  *(~10–14 weeks)*

**Goal:** sync a real district roster once and propagate it over events. This is the
make-or-break phase.

Deliverables:
- **IAM Service:** Cognito federation; Clever/ClassLink Instant Login; SAML; **LTI 1.3**
  provider; session & tenant-claim issuance.
- **AuthZ:** Amazon Verified Permissions (Cedar) with district/school/class scoping;
  policy test suite.
- **Roster Sync Service (Go):** Clever + ClassLink + OneRoster + CSV connectors; nightly
  reconcile + delta sync; normalization to canonical OneRoster.
- **Identity Matching & Dedup** with confidence scoring and an **admin review queue**.
- **Roster Graph Service:** canonical entities, gRPC read API, outbox + Debezium CDC.
- **Student Record & Outcomes Service:** minimized profile, append-only metric store,
  `student.metric.v1` ingestion.
- **Event backbone:** MSK + Schema Registry; topic taxonomy; idempotent consumer library;
  dead-letter + replay tooling.
- **Admin console (v1):** onboard a district, configure a connector, watch sync health,
  resolve identity-match exceptions.

**Exit criteria:**
- A pilot district's roster syncs from Clever **and** ClassLink into one canonical graph;
  duplicate identities are correctly merged/queued.
- A roster change at the source appears in a sample consumer's **local read model** within
  the target freshness SLO, via events (no shared DB).
- Sync freshness, drift, and DLQ dashboards/alerts are live.

---

## Phase 2 — First teacher loop: Curriculum (Links) + Assessment (SOLER)  *(~12–16 weeks)*

**Goal:** prove the end-to-end thesis with the two highest-coupling pillars.

Deliverables:
- **Curriculum Service (Links):** scope & sequence, levels, lessons, routines, materials;
  assignment of curriculum to classes/students using the roster graph read model; lesson
  delivery UI.
- **Assessment & Progress-Monitoring Service (SOLER):** assessments, data-collection
  sessions (trial-by-trial), evaluations, mastery, **report generation**.
- Both services consume roster events into **local read models** and emit
  `student.metric.v1`.
- **Student Record** consumes those metrics and publishes `student.progress.v1`; Curriculum
  subscribes to adapt instruction.
- Unified web shell + brand design system hosting both pillars under one sign-in.

**Exit criteria (the validating loop):** roster syncs → teacher sees their class in both
pillars with **zero re-import** → records data in SOLER → metric flows to Student Record →
Curriculum reflects progress → a SOLER report renders from canonical data. All over events,
no shared database, within SLOs.

---

## Phase 3 — Learning & Certification (SOLS) + Media  *(~12–16 weeks)*

**Goal:** complete the four pillars and the shared media capability.

Deliverables:
- **Media Service (platform):** S3 → MediaConvert → CloudFront pipeline; signed playback;
  **Transcribe** captions/transcripts; entitlement checks via IAM/Cedar.
- **Learning & Certification (SOLS):** adult course catalog, enrollments, progress, quizzes,
  certificates, CEUs, recertification; emits `course_completed` / `certification_earned`.
- **Media Center experience:** searchable, role-aware video library on OpenSearch over the
  Media Service; emits engagement metrics.
- Embedded media in Links lessons and SOLS courses (proving Media reuse).

**Exit criteria:** all four pillars run on the shared identity/roster/media substrate; an
educator's certification (SOLS) and a student's media engagement (Media Center) are both
visible to Reporting via events.

---

## Phase 4 — Unified reporting, analytics & admin  *(~8–12 weeks)*

**Goal:** cross-pillar insight and district administration at scale.

Deliverables:
- **Lakehouse:** Kafka → S3 (Iceberg) → dbt → Athena/Redshift; cross-pillar marts.
- **Reporting Service:** district/school/class/student dashboards; SOLER-style longitudinal
  reports; export (PDF/CSV) with audit.
- **Admin console (v2):** tenant lifecycle, role management, data-retention & DSAR tooling,
  connector & SSO self-service.
- Notifications service GA (assignment reminders, certification expiry, sync failures).

**Exit criteria:** a district admin sees unified progress across all four pillars from one
analytics surface, sourced from the lakehouse (not transactional DBs).

---

## Phase 5 — Hardening, compliance & scale  *(~ongoing, intensifies pre-GA)*

Deliverables:
- **SOC 2 Type II** readiness; FERPA/COPPA/SOPIPA control evidence; pen test; threat model.
- Full **WCAG 2.1 AA / Section 508** audit (manual + automated) across all pillars.
- Performance & load testing to district-scale; capacity plan; cost optimization.
- DR game days (RTO/RPO validation), chaos testing, runbooks, on-call.
- Optional service mesh (mTLS/traffic policy) as service count grows.

**Exit criteria:** production-ready for multi-district GA with security, accessibility,
performance, and DR evidence signed off.

---

## Team topology (Team Topologies model)

| Team | Type | Owns |
| --- | --- | --- |
| **Platform team** | Platform | Landing zone, golden-path template, CI/CD, observability, event backbone, mesh |
| **Data Engine team** | Stream-aligned (core) | IAM, Roster Sync, Roster Graph, Student Record — the spine |
| **Curriculum team** | Stream-aligned | Links service + experience |
| **Assessment team** | Stream-aligned | SOLER service + reports |
| **Learning team** | Stream-aligned | SOLS + Media Service + Media Center |
| **Reporting/Analytics team** | Stream-aligned | Lakehouse, dashboards, admin analytics |
| **Security & Compliance** | Enabling | Guardrails, audits, certifications, privacy program |
| **Design System / A11y** | Enabling | Brand design system, accessibility standards |

The **Data Engine team builds the spine in Phase 1**; pillar teams ramp in Phase 2+ as
the engine stabilizes. Enabling teams support everyone continuously.

---

## Top risks & mitigations

| Risk | Impact | Mitigation |
| --- | --- | --- |
| Roster identity mis-merge | Student safety/compliance incident | Confidence thresholds + human review queue + audit |
| Event-model churn breaks consumers | Platform-wide instability | Schema Registry + enforced backward compatibility + contract tests |
| Distributed-monolith creep (sync coupling) | Loses the whole benefit | Architecture fitness functions in CI; ban cross-service DB access; review gate |
| Compliance gaps surface late | Blocks district sales | Compliance-as-you-go from Phase 0; dedicated enabling team |
| Accessibility treated as polish | Excludes the core audience; legal risk | a11y gates in CI from Phase 0; audits each phase |
| Scope creep inside pillars before engine is proven | Wasted rework | Hard gate: no pillar GA until Phase 2 loop validates the engine |

---

## Immediate next steps (first two weeks)

1. Ratify ADRs 0001–0006; stand up the monorepo and AWS landing zone (Terraform skeleton).
2. Build the golden-path service template and ship a "hello-service" through CI/CD.
3. Sign data-sharing/SSO agreements and obtain **Clever/ClassLink sandbox** + an
   **OneRoster test dataset** to de-risk Phase 1 early.
4. Request STAR's official **brand guidelines** and turn them into design tokens.
5. Confirm the **pilot district** and its roster source(s).
