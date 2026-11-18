# Wound-care platform — Augi (clinician) + Selma (patient)

Two React frontends on **Vercel**, one API + agent runtime + Postgres on **Render**.

```
 Vercel                               Render
┌───────────────────┐   HTTPS/SSE   ┌───────────────────────────────────────┐
│ apps/clinician    │──────────────▶│ server (Express, Node 20)             │
│  Augi UI          │               │  ├─ REST + JWT auth (clinician|patient)│
├───────────────────┤               │  ├─ Agent runtime (Anthropic SDK)      │
│ apps/patient      │──────────────▶│  │    Augi: tools + durable HITL       │
│  Selma UI         │               │  │    Selma: patient-scoped tools      │
└───────────────────┘               │  ├─ SSE event bridge (role-filtered)   │
                                    │  └─ Billing pipeline (ICD-10 / CPT)    │
                                    └──────────────┬────────────────────────┘
                                                   │
                                          Render Postgres (state, audit log,
                                          agent threads, pending approvals, events)
```

## How the agents work

* **One loop, two agents** (`server/src/agents/runner.ts`): streams tokens from Claude, runs read-only tools immediately, and streams AG-UI-style events (`RUN_STARTED`, `TEXT_*`, `TOOL_*`, `HITL_*`, `SAFETY_ALERT`) to the browser over SSE.
* **Augi's write actions need a human.** `send_to_patient`, `escalate_to_ed`, `vascular_referral`, `modify_care_plan`, `request_labs` never run on the model's say-so. The call is saved as a `pending_actions` row, the run parks (`agent_threads.status = awaiting_approval`) and the stream ends. When the clinician approves/edits/rejects (`POST /api/augi/actions/:id/decision`) the server records the decision, executes the action, and resumes the model. State lives in Postgres, so approvals survive restarts and deploys and reappear after a page reload. Only whitelisted fields can be edited at approval time.
* **Selma is patient-scoped.** Every tool is bound to the `patientId` in the signed token; the model cannot name another patient. A deterministic red-flag detector (`@wc/shared`, with negation handling) runs on **every** patient message, before and independent of the LLM. It raises a de-duplicated alert for the care team and shows the patient emergency guidance even if the AI provider is down.
* **Patient-authored text is treated as data**, never instructions, in Augi's system prompt.
* **Billing**: CPT codes come only from procedures the clinician documented (in-person only); ICD-10 from parsed wound type/site/laterality/stage; the E/M level is a heuristic; every code carries reasoning and confidence; a clinician must approve codes; the audit log is hash-chained (`GET /api/patients/:id/audit/verify`).

## Organizations, roles and access control

Multi-tenant: every patient and staff account belongs to one **organization**; organizations cannot see each other. Within an org a **clinician only reaches patients assigned to them**.
Roles: `patient`, `clinician`, `org_admin` (staff/patients/assignments, **no clinical data**), `super_admin` (platform: orgs, cross-org analytics, pseudonymized dataset export, audited read-only record access with a mandatory reason).
All checks funnel through `server/src/access.ts` and fail closed (404). Full details, limits and first-boot steps: **[docs/multitenancy.md](docs/multitenancy.md)**.

## Telehealth video + AI scribe

* **Video:** real WebRTC (1:1). The API only relays signaling (SDP/ICE) through the existing event stream; media goes peer-to-peer or via your TURN server (`TURN_URLS`/`TURN_SECRET` — needed for reliable calls outside a LAN).
* **Consent:** when a visit starts the patient sees a consent card and can join **with or without** AI transcription. The choice is enforced server-side (no consent → no scribe token) and logged in the audit trail.
* **AI scribe (clinician-side capture):** the clinician's browser mixes mic + patient audio into 16 kHz stereo PCM and streams it over a WebSocket to the API, which streams it to **AWS HealthScribe** (`StartMedicalScribeStream`). Live captions are shown to the clinician only. Transcript turns are saved to Postgres as they finalize.
* **Review before coding:** ending a visit that has a transcript opens a review screen. The clinician can edit any line, then generates ICD-10/CPT suggestions (or discards the transcript). Each suggested code lists the transcript quotes it rests on. CPT procedure codes are never derived from a conversation.
* `SCRIBE_PROVIDER=mock` gives a clearly-labelled **simulated** transcript (no audio is transcribed) for local development and tests; it is refused in production. See **[docs/aws-healthscribe.md](docs/aws-healthscribe.md)** for AWS setup (IAM, bucket, env vars, TURN, sandbox checklist).

## Run locally

```bash
npm install
cp server/.env.example server/.env        # add ANTHROPIC_API_KEY to enable the agents
cp apps/clinician/.env.example apps/clinician/.env
cp apps/patient/.env.example apps/patient/.env
npm run dev:server                        # API on :8787, embedded PGlite DB, demo data seeded
npm run dev:clinician                     # http://localhost:5173
npm run dev:patient                       # http://localhost:5174
```

Demo logins (password = `DEMO_PASSWORD`, default `demo1234`) — two orgs to show isolation:

| Login | Role | Sees |
|---|---|---|
| `admin@demo.test` | platform super admin | all orgs (analytics, dataset, audited record access) |
| `orgadmin@demo.test` | org admin, Demo Wound Care Clinic | staff, patient registry, assignments (no clinical data) |
| `clinician@demo.test` | clinician | all 4 org-A patients |
| `clinician2@demo.test` | clinician | only Dorothy Simmons + Robert Tanaka |
| `orgadmin.b@demo.test`, `clinician.b@demo.test` | Riverside Podiatry Group | only org B's 2 patients (Linda Park, Samuel Ortiz) |
| `james.okafor@`, `margaret.chen@`, `dorothy.simmons@`, `robert.tanaka@`, `linda.park@`, `samuel.ortiz@demo.test` | patients (Selma app) | their own record |

Staff sign in on the Augi app (admins get an admin console instead of the clinical UI).

Tests: `npm test` (PGlite) or, against real Postgres, run each test file against its own empty database: `DATABASE_URL=postgres://…/db1 node --import tsx --test test/e2e.test.ts` (and `…/db2 … test/telehealth.test.ts`, `…/db3 … test/tenancy.test.ts`, `…/db4 … test/migration.test.ts`). A mock Anthropic server and a fake AWS client are used, so no keys or cost.

## Deploy

### 1. Render (API + Postgres)
1. Push this repo to GitHub.
2. Render → **New → Blueprint** → pick the repo. `render.yaml` defines the web service and Postgres; migrations run on boot.
3. Set the prompted secrets: `ANTHROPIC_API_KEY`, and `CORS_ORIGINS` (comma-separated list of the two Vercel URLs, no trailing slash; fill it in after step 2, then redeploy).
4. For a **demo only**: set `DEMO_SEED=true` and `DEMO_PASSWORD=<something>` for the first boot, then turn it off. For a **real install** set `BOOTSTRAP_SUPERADMIN_EMAIL` / `BOOTSTRAP_SUPERADMIN_PASSWORD` (≥12 chars) once, sign in at the Augi app, create your first organization, then remove the password variable (see docs/multitenancy.md).
5. Note the service URL (e.g. `https://wound-care-api.onrender.com`) and check `/healthz`.

### 2. Vercel (two projects, same repo)
For each of `apps/clinician` and `apps/patient`: **Add New → Project → import the repo → Root Directory = that folder**. The included `vercel.json` sets the install/build commands and the SPA rewrite. Environment variables:

| Var | Value |
|---|---|
| `VITE_API_URL` | your Render URL |
| `VITE_DEMO_MODE` | `true` only for a demo (prefilled/demo login) |

Then put both Vercel URLs into Render's `CORS_ORIGINS` and redeploy the API.

### Server environment variables
`DATABASE_URL`, `PGSSL`, `JWT_SECRET` (≥32 chars; generated by the blueprint), `JWT_TTL`, `CORS_ORIGINS`, `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL` (default `claude-sonnet-5-5`), `ANTHROPIC_MAX_TOKENS`, `DEMO_SEED`, `DEMO_PASSWORD`, `CODING_PROVIDER` (`rules` or `aws`), `AWS_REGION`, `BOOTSTRAP_SUPERADMIN_EMAIL`, `BOOTSTRAP_SUPERADMIN_PASSWORD`, `ANALYTICS_PSEUDONYM_SECRET`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `SCRIBE_PROVIDER` (`none`|`aws`|`mock`), `HEALTHSCRIBE_ROLE_ARN`, `HEALTHSCRIBE_OUTPUT_BUCKET`, `HEALTHSCRIBE_KMS_KEY_ID`, `HEALTHSCRIBE_NOTE_TEMPLATE`, `STUN_URLS`, `TURN_URLS`, `TURN_SECRET` (see docs/aws-healthscribe.md). In production the server refuses to start with a missing/short `JWT_SECRET` or a missing `DATABASE_URL`.

## What was tested, and what was not

**Tested**
* 27 server tests (7 end-to-end API, 8 telehealth/scribe/billing-evidence, 11 multi-tenancy/access-control, 1 single-tenant upgrade) on both PGlite and real Postgres 16: auth and roles, assessment → billing draft → approve, HITL pause/approve/edit/reject/resume with no double execution, read tools, Selma red-flag path, role-filtered SSE.
* Two API instances sharing one database (cross-instance event relay via LISTEN/NOTIFY).
* The production esbuild bundle boots and serves.
* Both frontends built with Vite and exercised in headless Chromium: login, dashboard, patient subpage, add wound, assessment with procedures, billing approve, audit trail, live Selma → Augi alert, and Augi proposal → Approve → patient receives the message.
* Two headless Chromium instances completing a real WebRTC call (fake camera/mic): consent granted and declined flows, live captions (mock scribe) on the clinician only, transcript review/edit, evidence-cited billing draft.
* The model in all of these tests was a **mock**. Behaviour with the real Claude model (prompt quality, tool choices) has not been evaluated.

**Not done / known limits — read before using with real patients**
* **Not HIPAA-ready out of the box.** You need BAAs with Anthropic, Render, Vercel (if PHI touches it) and AWS; a compliance review; encryption, backup and retention policies; PHI-safe logging.
* **The AWS HealthScribe client has never run against real AWS.** It follows the SDK's `StartMedicalScribeStream` types and is tested with a fake client (event order, channel mapping, pause/resume, error events). The S3 note file names/schema are not documented in what we could read, so that parser is defensive and the live transcript is the system of record. Run the sandbox checklist in `docs/aws-healthscribe.md` first. Likewise `CODING_PROVIDER=aws` (Comprehend Medical) is untested against real AWS.
* **Video needs TURN for reliability** and has only been tested between two Chromium instances with fake camera/mic on one machine (it works there). No testing on real networks, Safari/Firefox or mobile, and no screen-share or recording of the video itself.
* **Scribe capture runs in the clinician's browser tab:** if it closes mid-visit, the stream pauses (resumable on reconnect), and audio is only transcribed while the tab is open. Scribe WebSockets are pinned to one API instance for the duration of a visit.
* **Consent wording and recording-consent law vary by jurisdiction** — have legal/compliance review the text.
* **Coding rules are heuristics** and must be validated by a certified coder before any claim is submitted.
* **Tenant isolation is enforced in application code, not Postgres row-level security** (see docs/multitenancy.md for what is tested and the known limits). No MFA/SSO, self-service password reset or forced password change; admins set temporary passwords. The platform super admin can read any org's records (reason-required, audited, visible to the org) — have your privacy officer review that, and treat the pseudonymized dataset as sensitive: it is not certified de-identified. The audit hash chain is tamper-*evident* at the application level only; anchor hashes externally for stronger guarantees.
* UI files are `// @ts-nocheck` (ported prototype code). The server and shared package are type-checked.
* Check the plan names in `render.yaml` against the current Render dashboard. Free web instances sleep and will interrupt SSE streams.


## Wound photos, pathways and the treatment ladder
See [docs/photos-and-pathways.md](docs/photos-and-pathways.md). Production needs a new env var: `PHOTO_ENCRYPTION_KEY` (`openssl rand -base64 32`).

## Notifications
In-app inbox plus optional web push for both apps. See [docs/notifications.md](docs/notifications.md).

## Guideline library (RAG)
Upload guidelines and protocols that Augi cites. See [docs/guidelines-rag.md](docs/guidelines-rag.md).
