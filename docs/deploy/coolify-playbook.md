# Deployment Playbook — STAR OnePlatform (Coolify on a VPS)

**Goal:** deploy the full event-backbone stack as long-running containers on a
single VPS via **Coolify**, so the transactional-outbox relays and Kafka
consumers stay alive — the persistent server-side execution that Hostinger and
Vercel/serverless cannot provide.

> **Why not Vercel / App Runner?** Three services (`soler`, `links`,
> `student-record`) run always-on background loops — outbox relays and Kafka
> consumers. Serverless and request-driven platforms (incl. AWS App Runner)
> pause idle instances, which **stops those loops** and breaks the event
> backbone. A persistent container host runs all eight containers continuously.
> For production scale the ADR target is **EKS + MSK + Aurora**; this playbook
> is the right-sized path for the prototype/pilot.

---

## 0. What gets deployed

| Container | Image | Role | Public? |
| --- | --- | --- | --- |
| `web` | `Dockerfile.web` (Next standalone) | Frontend + BFF | **Yes** (HTTPS) |
| `roster-graph` | `Dockerfile.nest` | Identity/roster read API + Cedar authz | internal |
| `student-record` | `Dockerfile.nest` | Outcomes store + outbox relay + consumer | internal |
| `soler` | `Dockerfile.nest` | Assessment + offline sync + outbox relay | internal |
| `links` | `Dockerfile.nest` | Curriculum + `student.metric.v1` projector | internal |
| `predict` | `services/predict/Dockerfile` | scikit-learn model service | internal |
| `postgres` | `postgres:16-alpine` | Database (or managed Postgres) | internal |
| `redpanda` | `redpanda:v24.2.7` | Kafka-compatible event backbone | internal |
| `migrate` | `Dockerfile.migrate` | One-shot migrate + seed | exits |

Compose: [`infra/docker/docker-compose.prod.yml`](../../infra/docker/docker-compose.prod.yml).
Only `web` is published; everything else talks over the internal Docker network
by service name (`postgres:5432`, `redpanda:9092`, `roster-graph:3001`, …).

---

## 1. Provision the VPS

- **Size:** 4 vCPU / 8 GB RAM / 80 GB SSD to start (Hetzner CPX31, DO, etc.).
  The eight containers plus build headroom fit comfortably; scale up if Kafka +
  Postgres grow.
- **OS:** Ubuntu 22.04/24.04 LTS.
- **Networking:** open inbound `22`, `80`, `443` only. All service-to-service
  traffic stays on the Docker network — do **not** expose `3001–3005`, Postgres,
  or Kafka publicly.
- Point a domain (e.g. `app.staroneplatform.com`) **A record** at the VPS IP.

## 2. Install Coolify

```bash
ssh root@<vps-ip>
curl -fsSL https://cdn.coollabs.io/coolify/install.sh | bash
```

Open `http://<vps-ip>:8000`, create the admin account, and add this server as
the deployment target (Coolify installs Docker + a Traefik proxy for you).

## 3. Create the application (Docker Compose)

1. **Projects → New → Docker Compose**.
2. **Source:** connect the GitHub repo (`rechandy/STAR-ONEPLATFORM2`, branch
   `main`) via Coolify's GitHub App, or use a deploy key.
3. **Compose file path:** `infra/docker/docker-compose.prod.yml`.
4. **Build context:** repository root (the compose `build.context` is `../..`).
   Coolify builds every image from the repo on the server.

## 4. Configure environment & secrets

In the app's **Environment Variables**, set the values from
[`.env.production.example`](../../infra/docker/.env.production.example):

```
POSTGRES_USER=oneplatform
POSTGRES_PASSWORD=<strong-secret>      # or point DATABASE_URL at managed Postgres
POSTGRES_DB=oneplatform
WEB_PORT=3000
TENANT=star-demo
SYNC_DEMO_STAFF=T0026
```

Coolify stores these encrypted and injects them at deploy. **Never commit real
secrets** — the repo only ships `.env.production.example`.

> **Managed database (recommended for production):** instead of the `postgres`
> container, provision Amazon RDS/Aurora or DO Managed Postgres and override
> `DATABASE_URL` for every service to point at it. Remove the `postgres`
> service + its `depends_on` and keep nightly backups on the managed side.

## 5. Domain, SSL/TLS, and US delivery

1. In Coolify, set the **domain** for the `web` service to
   `https://app.staroneplatform.com` (port 3000).
2. Coolify provisions a **Let's Encrypt** certificate automatically and
   terminates **TLS** at its Traefik proxy; force HTTPS redirect on.
3. Keep the VPS in a **US region** for student-data residency. If you front it
   with a CDN, use CloudFront/Cloudflare with **US-only edge** + caching rules
   that never cache authenticated responses (the service worker already sets
   `no-store` on `/sw.js`).

## 6. Deploy

Click **Deploy**. Coolify will, in order:
1. Build all six application images from the repo.
2. Start `postgres` + `redpanda`; wait for health.
3. Run `migrate` (Prisma `migrate deploy` + idempotent seed) to completion.
4. Start `roster-graph`, `student-record`, `soler`, `links`, `predict`; wait for
   `/api/healthz` / `/api/readyz`.
5. Start `web` and route the domain to it.

First build takes a few minutes (pnpm install + Turbo build + Next build).

## 7. Verify (post-deploy smoke test)

```bash
# Web is up
curl -I https://app.staroneplatform.com

# Sign in (demo) and confirm the predictive model + authz path
curl -s -c j.txt -X POST https://app.staroneplatform.com/api/auth/login \
  -H 'content-type: application/json' -d '{"staffId":"T0026"}'
curl -s -b j.txt https://app.staroneplatform.com/students | grep -c "At Risk"
```

Then exercise the **event backbone** end-to-end: record a SOLER session in the
UI and watch the student's curriculum assignment flip to **Mastered** — this
confirms the outbox relay + Kafka consumer are running persistently (validated
in this build: web → soler → outbox → Redpanda → links projector → MASTERED).

## 8. Updates, rollback, persistence

- **Updates:** push to `main` → Coolify auto-redeploys (rebuild + rolling
  restart). The `migrate` step re-runs and is idempotent.
- **Rollback:** Coolify keeps previous deployments — one-click roll back.
- **Persistence:** the `pgdata` and `redpanda` named volumes survive
  redeploys; configure Coolify scheduled backups (or rely on managed Postgres
  backups).
- **Cache invalidation:** images are content-addressed per build; the Next
  service worker is served `no-store` and its precache is versioned per release,
  so clients pick up new assets without a stale-cache flush.

---

## 9. Predictive model & authz under production env (deliverable #4)

Both were validated running in the production images against the live stack.

**scikit-learn model (`predict`)**
- Reads `DATABASE_URL` (injected by Coolify). The trained `model.joblib` is
  baked into the image (the Dockerfile fails the build if it is missing); no
  training happens at runtime.
- `GET /api/readyz` returns `{model:true, db:true}` once connected.
- It is an **always-on container** (not serverless), so scoring latency has no
  cold start and a future **scheduled retraining** job can run alongside.
- Production hardening (see Production Readiness §8): model registry, drift
  monitoring, and a bias/fairness review; treat output as decision *support*.

**`@oneplatform/authz` guard (Cedar)**
- The guard runs inside each NestJS service. It needs only the service's
  `DATABASE_URL` (to resolve the roster slice it authorizes against) — no extra
  secrets — and the request identity headers (`x-tenant-id`, `x-user-id`) that
  the **web BFF injects server-side from the session**, never from the client.
- Validated: `roster-graph` `/api/me` and the `soler` `recordStudentData` check
  both pass in-container under production env (the session mutation was authorized
  end-to-end).
- Production hardening: replace the demo session cookie with real IAM/SSO
  (Cognito + Clever/ClassLink + MFA); the Cedar policies and guard code stay the
  same — only the identity source changes.

---

## 10. Notes & follow-ups

- **Image size:** the NestJS runtime copies the built workspace for reliability
  (~1.2 GB). Slim later with `pnpm deploy --prod` + an in-bundle `prisma
  generate`, or a `turbo prune --docker` multi-stage. (`web` is already a lean
  254 MB standalone image; `predict` ~714 MB.)
- **Kafka consumers start before producers:** the consumers use
  `fromBeginning:false`; on a cold deploy they join the group before any events
  are produced, so nothing is missed. Across redeploys the committed group
  offset resumes correctly (verified: events survive a consumer restart).
- **Scale path:** when one VPS is no longer enough, lift-and-shift to **EKS +
  MSK + Aurora** per ADR-0001/0003/0004 — the images and topology are unchanged;
  only the orchestrator and managed backing services change.
