# Multi-tenancy, roles and access control

## Roles

| Role | Belongs to | Can do | Cannot do |
|---|---|---|---|
| `patient` | one org (via their record) | Selma: own record, own messages, own video visits | anything about other patients |
| `clinician` | one org | Augi + clinical work on **patients assigned to them** | see unassigned patients (same org or otherwise); administer users |
| `org_admin` | one org | staff accounts, patient registry, clinician↔patient assignments, org activity log | **any clinical data** (wounds, assessments, billing, transcripts, Augi) |
| `super_admin` | no org (platform) | create/suspend orgs, add org admins, cross-org **aggregate** analytics, **pseudonymized dataset export**, identified record access with a mandatory reason | write to any clinical record; use the clinical routes |

## How isolation is enforced

* **One decision point** — `server/src/access.ts`. `canAccessPatient` allows: the patient themself, or a clinician with a row in
  `care_assignments` for that patient whose org matches. Everything else is denied, and denial is always a `404` (never `403`) so ids can't be probed.
* **Fail-closed routes** — `app.use("/api/patients/:pid", …)` gates *every* current and future route under a patient id.
  `loadPatients()` has no "load everything" mode: callers must pass the ids the user may see.
* **Accounts re-checked on every request** — the JWT only identifies the user; role, org, active flag and org status are re-read from the
  database (cached ≤5 s). Deactivating a user or suspending an org locks them out immediately on that instance, within ~5 s on others.
  A validly-signed token whose claims no longer match the account is rejected.
* **Live updates (SSE)** — events carry the patient's org (stamped server-side; payloads can't spoof it). A clinician only receives events for
  patients currently assigned to them, in order. Includes WebRTC signaling.
* **AI assistant** — every Augi tool call re-checks the *current user's* assignment, so the model can name any id but only reaches assigned patients.
  Pending approvals are visible/decidable only by an assigned clinician of the same org.
* **Telehealth** — session read, signaling, scribe token, scribe WebSocket (re-checked at connect), confirm/discard all require patient access.
* **Audit** — assignment changes and platform-admin record access are written to the patient's hash-chained audit trail. Administrative actions
  go to `admin_log`, which org admins can read (including every time a platform admin opened one of their patients).

## Super admin: what "see across all orgs" means here

1. **Aggregate analytics** (`/api/admin/analytics/summary`): counts, healing trends, billing and telehealth usage per org; small groups
   (<5 patients by default) are suppressed. No names, MRNs or free text.
2. **Pseudonymized dataset** (`/api/admin/export/dataset`, NDJSON, one row per assessment): keyed-hash subject/wound/org ids, 10-year age bands,
   year + day offsets instead of dates, clinical measurements, procedures. No names, MRNs, insurance, notes or transcripts. **This is
   pseudonymized, not certified de-identified.** Small cohorts and rare combinations can still be re-identifiable. Keep `ANALYTICS_PSEUDONYM_SECRET` stable.
3. **Identified record access** is read-only, needs a written reason, and is visible to the patient's org. Searching the roster is logged too.

Design choice worth revisiting with your privacy officer: the platform operator is a business associate with access to every org's PHI.
Under HIPAA's minimum-necessary rule most analytics/model-building should use the pseudonymized export; the identified view is for support and investigation.

## First boot / upgrades

* **New production install:** set `BOOTSTRAP_SUPERADMIN_EMAIL` + `BOOTSTRAP_SUPERADMIN_PASSWORD` (≥12 chars) once; the server creates a super admin
  only if none exists. Remove the password variable afterwards. Then sign in at the Augi app, create an organization (this also creates its first admin).
* **Upgrading a single-tenant deployment:** migration `003` moves all users and patients into "Default organization" and assigns **every clinician to every
  patient** so nobody loses access. Then use the super admin to add an admin to that org (`+ Admin`), and have them narrow assignments.

## Known limits (read before real use)

* **Isolation is enforced in application code, not by Postgres row-level security.** The tests below try hard to break it, and fail when any layer is
  removed, but a future query written without these helpers could leak. Adding RLS as a second layer is the natural next hardening step.
* Revocations propagate in ≤5 s across multiple API instances (immediate on the instance that made the change).
* Emails are unique platform-wide (one account per email address).
* No MFA, SSO, self-service password reset or forced password change at first login; admins set temporary passwords and must share them securely.
  There is only an IP-based login rate limit, no per-account lockout.
* `admin_log` is append-only by convention but, unlike the per-patient audit trail, is not hash-chained.
* Agent conversation history (Augi/Selma threads) is stored per user and is not part of the export or the super-admin view.
* Not tested: multiple API instances against one database for the new access cache, large datasets (export is capped at 100k rows per request), browsers other than Chromium.

## Tests

`server/test/tenancy.test.ts` (11 tests) covers cross-org and unassigned access on every patient route (including a route that doesn't exist yet),
admins having no clinical access, SSE leakage and revocation, telehealth/signaling/scribe, Augi tool and approval scoping, user/org lifecycle
(deactivate, suspend, last-admin protection), analytics and export leakage checks, audited record access, and forged/mismatched tokens.
`migration.test.ts` checks the single-tenant upgrade. As a sanity check, deliberately breaking each protection (assignment check, event filter,
Augi scoping, account re-validation) makes the relevant tests fail.
