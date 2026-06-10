# STAR OnePlatform — Loom Demo Script (synchronized)

A ~8.5-minute walkthrough of the whole platform and all four pillars, with
on-screen actions paired to a deep, formal, measured voiceover in the register
of **James Earl Jones** — gravitas, deliberate pacing, generous pauses.

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
| **5:00–5:55** | Click an **At Risk** student (**Ethan Perez**) → `/students/S00001`. The record shows each IEP goal, color-coded, with a probability and current accuracy. | "We open a child the model has flagged. Here — for each goal of the Individualized Education Program — is a prediction: the probability that this student will meet the goal by the annual review. These figures are the work of a logistic-regression model — scikit-learn — served from its own process, and scored against the living record of the child's progress. Forty percent. Fifty. Each one banded: on track… monitor… at risk. It is not a verdict. It is a flag — to summon the educator's judgment… sooner." |
| **5:55–6:55** | Top-right **Sign out**. Sign in as **`A0001`** (administrator). On the dashboard, note **Leadership insights** now appears. Open it (`/insights`). Show the district-wide distribution bar (red/yellow/green) and the top at-risk students. | "Now we change our vantage — and enter as a district leader. The platform knows the difference. New doors appear. This is the leadership view: every active goal across the district, distilled into a single portrait of risk — and the students who must be reached first. And it is drawn from the very same events the teacher's work produced. One record. Two altitudes. The classroom… and the district… in perfect agreement." |
| **6:55–7:25** | Resize the browser to **tablet**, then **phone** width (or use device emulation). Show the student record and dashboard reflow cleanly. | "Because this work is done on the devices of the classroom — the tablet in the hand, the telephone in the pocket — the platform was built, from its first line, to meet them there. Desktop. Tablet. Phone. One experience… no compromise." |
| **7:25–8:15** | Optional: show a simple architecture diagram, or `docker compose ps` in a terminal, then return to the dashboard. | "Beneath all of this lies a deliberate architecture. A constellation of focused services — identity, curriculum, assessment, outcomes, prediction — each owning its own data… speaking only through events. A canonical model, drawn from an open standard. Authorization decided by policy — not by rules scattered through the code. And a deployment built for permanence: containerized… and always running… because the event backbone must never pause. What you have seen is a prototype. But it is not a sketch. It is the foundation — already standing." |
| **8:15–8:45** | Return to the dashboard, or a closing STAR title card. | "Four products. One platform. One unbroken record of every child's progress — from the moment a teacher records it… to the decision a leader makes because of it. This… is STAR OnePlatform. The work… begins now." |

---

## Optional trims (to reach ~5 minutes)

- Merge Scene 9 (responsive) into a 5-second aside during Scene 7.
- Cut Scene 10 to two sentences (services + events; always-on deployment).
- Hold Scene 3 (Links) to ~20 seconds.

## Capability → scene coverage (for your reference)

| Capability / pillar | Scene |
| --- | --- |
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
