# OnePlatform — Foundational Architecture Blueprint

**Status:** Draft v1 · **Audience:** Engineering, Architecture, Product, Security ·
**Scope:** Greenfield, AWS, K-12 special education

---

## 1. Vision & first principles

OnePlatform turns STAR's four standalone products into **services on one platform**
that share identity, rosters, student records, media, and reporting. A teacher signs in
once and moves between curriculum, data collection, training, and video without
re-rostering, re-keying student lists, or stitching reports together by hand.

### Architectural principles

1. **One canonical model of "who" and "where."** Organizations, schools, classes,
   enrollments, educators, and students live in **one** authoritative place
   (the Unified Data Engine), modeled on the **1EdTech OneRoster** standard. Every other
   service consumes a replicated, read-optimized slice — never a second source of truth.
2. **Database-per-service, not database-per-platform.** Each service owns its data and
   schema. No service reaches into another's tables. Sharing happens through **APIs and
   events**, never shared SQL.
3. **Event-driven by default, synchronous only when necessary.** State changes (a new
   enrollment, a mastered objective) are published as immutable events; services react and
   keep local read models. Synchronous calls are reserved for read-time queries that
   cannot be pre-materialized.
4. **Contracts are sacred.** Every API has an OpenAPI/Protobuf contract under version
   control; every event has a registered, versioned schema. Backwards compatibility is a
   release gate.
5. **Multi-tenant from line one.** The tenant is the **district/organization**. Tenant
   isolation, data residency, and per-tenant configuration are foundational, not retrofits.
6. **Privacy, security, and accessibility are non-negotiable requirements**, not
   features. Student data triggers FERPA/COPPA/SOPIPA obligations; the audience demands
   WCAG 2.1 AA / Section 508 conformance.
7. **Loose coupling, high cohesion, independent deployability.** A team should ship its
   service without a coordinated release train.
8. **Make the right thing the easy thing.** A golden-path service template, shared
   libraries, and platform tooling mean teams inherit security, observability, and
   contracts for free.

### Explicit non-goals (for the foundation)

- No "big bang" cutover — products go live incrementally behind the unified shell.
- No shared application database, no cross-service foreign keys, no distributed monolith.
- No bespoke roster format — we speak OneRoster and let connectors translate.

---

## 2. Domain decomposition (bounded contexts)

We use Domain-Driven Design. Each bounded context maps to one (sometimes two) services.

### Platform / core domains (the shared substrate)

| Context | Responsibility | Owns |
| --- | --- | --- |
| **Identity & Access (IAM)** | Authentication, SSO federation, RBAC/ABAC authorization | Users, credentials, sessions, roles, permission policies |
| **Roster Sync** | Ingest & normalize district rosters from Clever / ClassLink / OneRoster / CSV | Connector configs, sync jobs, source records, mapping/dedup state |
| **Organization & Roster Graph** | Canonical org → school → class → enrollment graph | Orgs, schools, terms, courses, classes, enrollments |
| **Student Record & Outcomes** | Canonical student profile + unified outcome-metric store | Student demographics (minimized), IEP-adjacent flags, metric time series |
| **Media** (platform service) | Ingest, transcode, caption, store, and securely stream video/assets | Media assets, renditions, captions, playback entitlements |
| **Content/Files** | Generic document/asset storage with virus scanning & signed access | Files, versions, access grants |
| **Notifications** | Email/in-app/webhook delivery with templates & preferences | Messages, templates, delivery logs |
| **Reporting & Analytics** | Cross-service, cross-tenant reporting & dashboards | Lakehouse models, report definitions, materialized marts |
| **Audit & Compliance** | Immutable audit trail, consent, data-subject requests, retention | Audit events, consent records, retention policies |

### Product domains (the four pillars)

| Context | Pillar | Responsibility |
| --- | --- | --- |
| **Curriculum** | Links | Curriculum structure (scope & sequence, levels, lessons, routines, materials), assignment to classes/students, lesson delivery |
| **Assessment & Progress Monitoring** | SOLER | Assessments, data-collection sessions (e.g., trial-by-trial ABA data), evaluations, mastery, report generation |
| **Learning & Certification** | SOLS | Adult course catalog, enrollments, progress, quizzes, certificates, CEUs, recertification |
| **Media Center (experience)** | Media Center | Curated, searchable video experience built on the platform Media Service |

> **Why split "Media Service" from "Media Center"?** Video isn't only the Media Center's
> concern — Links lessons embed instructional clips and SOLS courses embed training videos.
> The *platform Media Service* handles ingest/transcode/stream/caption once; the *Media
> Center* is one of several experiences that consume it. This is the reuse the unification
> promise depends on.

---

## 3. Service catalog & interaction styles

```
                         ┌──────────────────────────────────────────────┐
                         │                  Web / Mobile                 │
                         │      Next.js shell + brand design system      │
                         └───────────────────────┬──────────────────────┘
                                                 │  HTTPS (OIDC session)
                                  ┌──────────────▼───────────────┐
                                  │     API Gateway + BFF         │  REST/GraphQL
                                  │  (authn edge, rate limiting)  │
                                  └──────┬─────────────┬──────────┘
              gRPC (read) / async events │             │
        ┌───────────────────────────────┼─────────────┼───────────────────────────┐
        │            PRODUCT SERVICES    │             │     CORE/PLATFORM SERVICES │
        │  ┌───────────┐ ┌────────────┐  │             │  ┌─────────┐ ┌───────────┐ │
        │  │ Curriculum│ │ Assessment │  │             │  │  IAM    │ │  Roster   │ │
        │  │  (Links)  │ │  (SOLER)   │  │             │  │         │ │   Sync    │ │
        │  └─────┬─────┘ └─────┬──────┘  │             │  └────┬────┘ └─────┬─────┘ │
        │  ┌─────┴─────┐ ┌─────┴──────┐  │             │  ┌────┴────┐ ┌─────┴─────┐ │
        │  │   SOLS    │ │   Media    │  │             │  │ Roster  │ │  Student  │ │
        │  │  (L&C)    │ │  Center    │  │             │  │  Graph  │ │  Record   │ │
        │  └───────────┘ └─────┬──────┘  │             │  └─────────┘ └───────────┘ │
        └──────────────────────┼─────────┴─────────────┴────────────────────────────┘
                               │ consumes                     ▲ publishes/consumes
                         ┌─────▼──────┐                       │
                         │   Media    │             ┌─────────┴──────────┐
                         │  Service   │             │  Event Backbone     │
                         └────────────┘             │  (Kafka / MSK +     │
                                                     │  Schema Registry)   │
                                                     └─────────────────────┘
```

### Communication patterns (the rule of three)

- **Synchronous request/response (gRPC internally, REST/GraphQL at the edge):** for
  read-time queries and user-initiated commands needing an immediate answer.
- **Asynchronous events (Kafka):** for propagating state changes (roster updates, metric
  recorded, certificate earned). This is how rosters and metrics "plug into" every service
  without coupling.
- **Bulk/batch (S3 + jobs):** for roster file imports, large report builds, lakehouse ETL.

> **Golden rule:** a service may *call* a core service synchronously for a fresh read, but
> for anything on its hot path it keeps a **local read model** updated by events. This is
> what makes rosters feel instantaneous everywhere.

---

## 4. Recommended technology stack (best-fit, AWS)

Chosen for: K-12 scale, data-heavy outcome streams, fast hiring, AWS-native operations,
and long-term portability. Deliberately constrained to **two backend languages** to keep
the operational surface area sane.

### Languages & frameworks

| Concern | Choice | Why |
| --- | --- | --- |
| Default service language | **TypeScript + NestJS** | Shared types with the web app, huge hiring pool, batteries-included DI/modules, great DX |
| Data-plane / high-throughput services (Roster Sync, Outcomes ingestion, event processors) | **Go** | Predictable latency, low memory, excellent concurrency for stream processing |
| Web frontend | **Next.js (React) + TypeScript** | SSR/streaming, mature a11y ecosystem, one language end-to-end |
| Shared UI | **Design-system package** (React + Tailwind + Radix/Headless UI, tokens from STAR brand) | One accessible, on-brand component library across all pillars |
| Monorepo tooling | **Turborepo or Nx + pnpm** | Shared contracts, libs, and design system; incremental builds |

### Data stores (per service — never shared)

| Need | Choice |
| --- | --- |
| Transactional OLTP | **Amazon Aurora PostgreSQL** (one logical DB per service) |
| Outcome / metric time series | Aurora PostgreSQL with **time-partitioned tables** (Timescale-style) for operational reads; **S3 + Apache Iceberg** for analytics |
| Search & discovery (curriculum, media) | **Amazon OpenSearch** |
| Cache / sessions / rate limits | **Amazon ElastiCache (Redis)** |
| Object storage (media, files, exports) | **Amazon S3** (+ KMS encryption) |
| Analytics warehouse / lakehouse | **S3 (Iceberg) + Athena**, promoting to **Redshift** when query volume warrants |

### Platform & integration

| Concern | Choice |
| --- | --- |
| Eventing | **Amazon MSK (Kafka)** + **Schema Registry** (Avro/Protobuf) |
| Change Data Capture / Outbox | **Debezium** reading the transactional outbox table per service |
| Internal API | **gRPC** (Protobuf contracts) |
| External / BFF API | **REST (OpenAPI 3.1)**; **GraphQL** optional at the BFF for the web app |
| AuthN | **Amazon Cognito** (OIDC/SAML federation) + **Clever / ClassLink Instant Login** + **LTI 1.3** provider |
| AuthZ | **Amazon Verified Permissions (Cedar)** for fine-grained, relationship-aware policies (district/school/class scoping) |
| Media pipeline | **S3 → AWS Elemental MediaConvert → CloudFront** (signed URLs); **Amazon Transcribe** for captions/transcripts |
| Secrets | **AWS Secrets Manager** + KMS |

### Runtime, delivery & operations

| Concern | Choice |
| --- | --- |
| Compute | **Amazon EKS (Kubernetes)** for portability (Fargate profiles for bursty/low-ops workloads) |
| IaC | **Terraform** (with Terragrunt or stacks per environment) |
| Deploy / GitOps | **GitHub Actions** → **Amazon ECR** → **Argo CD** |
| Service mesh (optional, phase-gated) | **Istio or Linkerd** for mTLS + traffic policy once service count grows |
| Observability | **OpenTelemetry** → **Amazon Managed Prometheus + Managed Grafana**, traces via **Tempo/X-Ray**, logs via **Loki/CloudWatch** |
| Error tracking | **Sentry** |
| API gateway | **AWS API Gateway** or **Kong/Envoy** at the edge |

> See [ADR-0006](../adr/0006-polyglot-stack-boundaries.md) for the language-boundary rules
> and [ADR-0005](../adr/0005-cedar-authorization.md) for why authorization is centralized
> on Cedar rather than baked into each service.

---

## 5. Cross-cutting concerns

### 5.1 Multi-tenancy

- **Tenant = organization (district / agency).** Every row in every service carries a
  `tenant_id`; **PostgreSQL Row-Level Security** enforces isolation defensively even if app
  code has a bug.
- **Pooled by default, siloed on demand.** Most tenants share infrastructure (pooled,
  cost-efficient). Very large districts or those with data-residency contracts can be
  placed in a **dedicated silo** (separate DB/cluster) without code changes.
- **Tenant context propagation:** the gateway resolves the tenant from the authenticated
  session and injects a signed tenant claim into every downstream call and event header.

### 5.2 Identity, SSO & roles

- Educators and admins sign in via **district SSO** (Google Workspace, Microsoft Entra,
  Clever/ClassLink Instant Login, SAML). Students, where applicable, use rostered SSO.
- **LTI 1.3 / LTI Advantage** lets OnePlatform launch from a district LMS (Canvas,
  Schoology) and pull rosters via the **Names and Roles Provisioning Service**.
- Roles are scoped to the roster graph: *Teacher of Class X*, *School Admin of School Y*,
  *District Admin of Org Z*, *STAR Internal Support*. Cedar evaluates "can this principal
  perform this action on this resource within this scope?"

### 5.3 Security & compliance

- **Regulatory scope:** FERPA, COPPA, **SOPIPA** (CA) and equivalent state student-data
  laws; target **SOC 2 Type II** for districts' vendor reviews.
- **Data protection:** encryption in transit (TLS 1.2+/mTLS between services) and at rest
  (KMS); **field-level encryption / tokenization** for sensitive student PII; strict data
  minimization (collect only what a pillar needs).
- **Auditability:** every read/write of student data emits an immutable audit event;
  retention and **data-subject deletion** ("right to be forgotten") are first-class.
- **Network:** private subnets, security groups, no public DB; secrets never in env files.
- **Supply chain:** signed images, SBOMs, dependency scanning, IaC policy checks in CI.

### 5.4 Accessibility (a core requirement, given the audience)

- **WCAG 2.1 AA + Section 508** conformance is a release gate for every UI.
- Captions/transcripts on all media (auto-generated via Transcribe, human-reviewed).
- Keyboard-first, screen-reader-tested components in the shared design system; automated
  a11y checks (axe) in CI plus periodic manual audits.

### 5.5 Observability & SLOs

- **OpenTelemetry everywhere**; correlation IDs flow from the browser through the gateway,
  services, and events.
- Per-service **SLOs** (availability, p95 latency) and **error budgets**; golden signals
  dashboards provisioned automatically from the service template.
- Roster sync gets dedicated health: freshness ("hours since last successful sync"),
  delta volume, and reconciliation-mismatch alerts.

### 5.6 Resilience

- Idempotent consumers, **outbox pattern** for exactly-once-effect publishing, **dead-letter
  topics**, retries with backoff, circuit breakers on synchronous calls.
- Multi-AZ by default; documented RTO/RPO; regular restore drills; **Saga pattern** for
  multi-service workflows (e.g., provisioning a class across Curriculum + Assessment).

---

## 6. Brand & experience layer

OnePlatform presents one coherent, STAR-branded experience across pillars.

- A single **design system** package encodes STAR's brand as **design tokens** (color,
  type, spacing, motion, the star motif) so all four pillars look like one product.
- **Brand tokens are placeholders pending STAR's official brand guidelines** — source the
  exact palette, logo lockups, and typography from STAR Marketing before UI build, and wire
  them in as tokens (no hard-coded hex values in components).
- Per-pillar theming is allowed only via approved token variations (e.g., a pillar accent),
  never by diverging components — consistency and accessibility stay centralized.

---

## 7. C4 container view (Mermaid)

```mermaid
flowchart TB
  user([Teacher / Admin / Coach])
  subgraph Edge
    web[Next.js Web App + Design System]
    gw[API Gateway + BFF]
  end
  subgraph Core[Unified Data Engine + Platform]
    iam[IAM Service]
    sync[Roster Sync Service]
    graph[Roster Graph Service]
    rec[Student Record & Outcomes]
    media[Media Service]
    notif[Notifications]
    audit[Audit & Compliance]
    report[Reporting & Analytics]
  end
  subgraph Products
    links[Curriculum / Links]
    soler[Assessment / SOLER]
    sols[Learning & Cert / SOLS]
    mc[Media Center]
  end
  bus[(Kafka / MSK + Schema Registry)]
  ext[(Clever / ClassLink / OneRoster / LMS via LTI 1.3)]

  user --> web --> gw
  gw --> iam & links & soler & sols & mc & report & media
  ext --> sync --> graph
  graph -- events --> bus
  rec -- events --> bus
  bus --> links & soler & sols & mc & report
  links & soler & sols & mc -- metrics/events --> bus --> rec
  Products -. audit .-> audit
  Core -. audit .-> audit
  mc --> media
  links --> media
  sols --> media
```

---

## 8. What "done" looks like for the foundation

The foundation is complete when:

1. A district can be onboarded and its roster synced from Clever/ClassLink/OneRoster into
   the canonical graph **once**, and that roster appears — without re-import — in
   Curriculum, Assessment, SOLS, and Media Center.
2. A student outcome recorded in Assessment (SOLER) is queryable by Curriculum (to adapt
   instruction) and by Reporting (for dashboards) **via events**, with no shared database.
3. A new service can be stood up from the golden-path template and inherit authn, authz,
   tenancy, observability, contracts, and CI/CD on day one.
4. Security, privacy, and accessibility gates pass in CI for every service.

The remaining documents detail the **Unified Data Engine** (the mechanism behind #1 and #2)
and the **phased roadmap** to get there.
