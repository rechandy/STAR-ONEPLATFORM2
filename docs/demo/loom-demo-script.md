# STAR OnePlatform — Loom Demo Script (synchronized)

A first-person **Introduction & Method** (your own voice, ~2 min) followed by a
~8.5-minute walkthrough of the whole platform and all four pillars — the demo
body paired to a deep, formal, measured voiceover in the register of
**James Earl Jones** (gravitas, deliberate pacing, generous pauses). Total ~10–11
min; see “Optional trims” to reach ~7.

---

## Pre-flight (before you hit record)

1. **Bring up the full stack (fresh data):**
   ```bash
   docker compose -f infra/docker/docker-compose.prod.yml down -v
   docker compose -f infra/docker/docker-compose.prod.yml up -d --build
   ```
   `down -v` clears the volumes so the seed is pristine and the mastery flip is
   fresh; wait until all containers are healthy.
2. Open **`http://localhost:3000` in a fresh Incognito window** (empty
   IndexedDB → the SOLER offline-pull is a genuine first sync).
3. Demo accounts: teacher **`T0026`** (Oliver Williams), administrator
   **`A0001`** (Carter Davis). Demo student: **Ethan Perez** (`S00001`).
4. Window ~1280×800 for desktop scenes; you'll resize for Scene 9.

## Delivery direction (the voice)

- Lower register, slow cadence (~2.5 words/sec). Land the pauses marked “—”.
- Authoritative, never hurried. Each sentence is a statement of fact.
- Let the UI action complete, *then* deliver the line over the result.
- **Two voices:** the *Introduction & Method* below is spoken by **you**, first
  person (talking head or voiceover). The *demo body* uses the deep ElevenLabs
  narration from `generate_narration.py` — third person, JEJ register. (If you
  re-edit a demo-body line, re-run the generator to refresh that segment.)

---

## Introduction & Method (presenter, first person — record before the demo)

> Your own voice. This is the "method over features" framing the exercise asks
> for: how you went from documents to running code, how you directed the AI,
> where you intervened, and the plan to production.

| Time | On-screen | Presenter narration (first person) |
| --- | --- | --- |
| **0:00–0:20** | Talking head, or a title card "STAR OnePlatform — build walkthrough". | "Hi — I'm Ruben. In a single focused build, I took STAR's One Platform from a stack of exercise documents to a running, deployed system. Before I show it to you, let me tell you how it was built — and where my judgment shaped it." |
| **0:20–0:55** | Show the repo / docs folder / a simple architecture sketch. | "I treated AI as a team I directed — not a tool I waited on. I used **ChatGPT** to investigate STAR's strategic direction and the domain: special education, IEPs, and the four products. I used **Gemini** to turn that thinking into precise, high-signal prompts. Those prompts drove **Claude Code**, which did the heavy lifting in the codebase — scaffolding the services, wiring the event backbone, generating the predictive model and the interface. And this walkthrough itself was produced with **Loom** for capture and **ElevenLabs** for the narration you'll hear in the demo." |
| **0:55–1:40** | Show `docs/adr/`, the service list, or the architecture docs. | "But the AI moves fast in whatever direction you point it — so the architecture, and the corrections, were mine. Five decisions mattered most. **One:** microservices around a single canonical model — OneRoster — so identity and roster are defined once, and trusted everywhere. **Two:** an event-driven backbone — a transactional outbox onto Kafka, a database per service — so no service reaches into another's data. **Three:** I rejected serverless for deployment; the outbox relays and event consumers must run persistently, so I chose an always-on container host. **Four:** authorization as policy, with Cedar — not rules scattered through the code. **Five:** the predictive model as its own Python service, not bolted onto the app. And where the AI drifted, I intervened — I caught a tenant-scoping leak in a sync query, a race where a cross-service update lagged the sync, and a packaging bug in the production Docker build. The machine wrote much of the code. The decisions were human." |
| **1:40–2:10** | Show the three PDFs in `docs/reports/` (task plan, budget, readiness). | "I also planned the road to production. The **task plan**: roughly eight months to a deployable MVP with a team of five. The **budget**: about one-point-two million dollars to build, and one-point-eight million a year to operate at the initial scale of twenty-five hundred districts. And a board-level **production-readiness** assessment that rates this honestly — a validated prototype, perhaps a third of the way to general availability — with the gaps named: real single sign-on, live roster connectors, the remaining two products, and the security and FERPA compliance that student data demands. **That is what I would build next.** Now — let me show you the platform." |

---

## The script

| Time | On-screen action | Voiceover narration (James Earl Jones register) |
| --- | --- | --- |
| **0:00–0:20** | Title card or the STAR sign-in screen, held still. | "For those who teach the children others find hardest to reach, the tools have always been many — and the story, fragmented. Today, that ends. This… is STAR OnePlatform. Four products. One foundation. One unbroken record of every child's progress." |
| **0:20–0:50** | On `/login`, type staff ID **`T0026`**, click **Continue**. Dashboard loads. | "We begin as a teacher signs in. A single identity — one login — opens the entire platform. Behind this simple gate stands a dedicated identity and roster service, modeled on the OneRoster standard… where every student, every class, every relationship is defined once — and trusted everywhere." |
| **0:50–1:35** | Dashboard. Slowly move across the four pillar cards: **Links** (Open), **SOLER** (Open), **STAR Online Learning** (Not licensed), **Media Center** (Coming soon). | "Observe the landing page. It is not a fixed picture. It is assembled — in the moment — from this district's licenses. Links, and SOLER, stand open. STAR Online Learning, unlicensed here, is sealed. The Media Center waits in the wings. The same platform shows each district only what is theirs — composed at the instant of request, from a single source of truth." |
| **1:35–2:20** | Click **Links Curriculum → Open**. On `/links`, scroll slowly through the domains and objectives. | "We enter Links — the curriculum. Here is the scope and sequence: the research-based map of skills — communication, behavior, daily living, social, academic readiness — each objective carrying its own teaching routine. This is the catalog from which every assignment is drawn… read from a service that owns the curriculum, and the curriculum alone." |
| **2:20–3:20** | Back to dashboard → **SOLER → Open**. Note the “Cached offline: … students · goals · assignments” line. Select **Ethan Perez**, a **Social Skills** goal, set **Correct = 10**, click **Record session offline**. Point to “Outbox: 12 pending.” | "Now — to the heart of the work. SOLER… where teachers collect data, trial by trial. But the classroom does not wait for the network. Observe: this child's roster, goals, and curriculum were drawn down to the device in advance. I record a session — ten trials, each one correct. It does not travel to a server. It is written — instantly, and durably — to an outbox, on the device itself. Twelve operations, held in safety. The teacher… is never blocked." |
| **3:20–4:20** | Click **Sync now**. Watch the outbox drain to 0. Scroll to the student's assignments — the Social Skills objective flips **In Progress → Mastered**. | "And now… we synchronize. Each operation is delivered — exactly once — to the assessment service, which records the outcome and commits an event, through a transactional outbox, onto an event backbone. A second, independent service is listening. It hears that the goal has been mastered… and advances the child's curriculum — on its own. No service reached into another's database. One teacher's action, recorded but once, ripples across the platform as a single, ordered truth. This… is the engine that serverless could not hold. And it does not sleep." |
| **4:20–5:00** | Dashboard → **My students & risk** (`/students`). The caseload, ranked highest-risk-first, with red/yellow/green chips. | "From data… comes foresight. This is the teacher's caseload — every student, ranked by risk. Green. Yellow. Red. The platform does not merely store what has happened. It tells the teacher… where to look first." |
| **5:00–6:00** | Click an **At Risk** student (**Ethan Perez**) → `/students/S00001`. The record shows each IEP goal, color-coded, with a probability and current accuracy. Pause on one goal's percentage. | "We open a child the model has flagged. For each goal of the Individualized Education Program, here is a prediction — the probability that this student will meet the goal by the annual review. Behind it stands a logistic-regression model, built with scikit-learn, and trained on the platform's own history of outcomes: the current accuracy… the trend, week over week… the change in prompt level… the streak of progress sessions. It runs in a service of its own — in Python — scoring each goal, live, against the child's record drawn from the shared data spine. The result is banded by confidence: at or above seventy-five percent — on track; between fifty and seventy-five — monitor; below fifty — at risk. It is not a verdict. It is a flag — surfaced to the teacher, and to leadership — to summon human judgment… sooner. And the data never leaves the platform." |
| **6:00–7:00** | Top-right **Sign out**. Sign in as **`A0001`** (administrator). On the dashboard, note **Leadership insights** now appears. Open it (`/insights`). Show the district-wide distribution bar (red/yellow/green) and the top at-risk students. | "Now we change our vantage — and enter as a district leader. The platform knows the difference. New doors appear. This is the leadership view: every active goal across the district, distilled into a single portrait of risk — and the students who must be reached first. And it is drawn from the very same events the teacher's work produced. One record. Two altitudes. The classroom… and the district… in perfect agreement." |
| **7:00–7:30** | Resize the browser to **tablet**, then **phone** width (or use device emulation). Show the student record and dashboard reflow cleanly. | "Because this work is done on the devices of the classroom — the tablet in the hand, the telephone in the pocket — the platform was built, from its first line, to meet them there. Desktop. Tablet. Phone. One experience… no compromise." |
| **7:30–8:20** | Optional: show a simple architecture diagram, or `docker compose ps` in a terminal, then return to the dashboard. | "Beneath all of this lies a deliberate architecture. A constellation of focused services — identity, curriculum, assessment, outcomes, prediction — each owning its own data… speaking only through events. A canonical model, drawn from an open standard. Authorization decided by policy — not by rules scattered through the code. And a deployment built for permanence: containerized… and always running… because the event backbone must never pause. What you have seen is a prototype. But it is not a sketch. It is the foundation — already standing." |
| **8:20–8:50** | Return to the dashboard, or a closing STAR title card. | "Four products. One platform. One unbroken record of every child's progress — from the moment a teacher records it… to the decision a leader makes because of it. This… is STAR OnePlatform. The work… begins now." |

---

## Optional trims (to reach ~7 minutes)

- Tighten the Introduction to ~75s: keep the AI-orchestration beat and the
  five decisions; compress the plan/budget/readiness beat to two sentences.
- Merge Scene 9 (responsive) into a 5-second aside during Scene 7.
- Cut Scene 10 to two sentences (services + events; always-on deployment).
- Hold Scene 3 (Links) to ~20 seconds.

## Notes

- The **Introduction** is your own voice — do not run it through the ElevenLabs
  track. The demo body is the JEJ narration from `generate_narration.py`.
- **Scene 7 was deepened** (model mechanics + integration). If you've already
  rendered audio, re-run the generator to refresh `scene_07.mp3` and the unified
  track: `python docs/demo/generate_narration.py --voice <id>`.

## Coverage (for your reference)

| Capability / point | Where |
| --- | --- |
| Process: documents → running code; directing Claude Code / Gemini / ChatGPT / Loom / ElevenLabs | Intro |
| Interventions + architectural decisions & rationale | Intro |
| Task plan · budget · production-readiness summary | Intro |
| What's missing & what I'd build next | Intro |
| Role-based auth · single sign-on | 1 |
| Dynamic licensed landing page | 2 |
| Links (curriculum pillar) | 3 |
| SOLER (assessment pillar) · offline-first | 4 |
| Event backbone · transactional outbox · CQRS | 5 |
| Planning/Orchestration · at-risk surfacing | 6 |
| Predictive model (scikit-learn) on student record | 7 |
| Admin/Leadership view · reporting | 8 |
| Responsive (desktop/iPad/phone) | 9 |
| Microservices · OneRoster · Cedar authz · containerized deploy | 10 |
