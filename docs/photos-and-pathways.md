# Wound photos, care pathways and the treatment ladder

Three features added for the post-op pilot (roadmap Phase 1). What each does, how it is protected, and what it does **not** do yet.

## 1. Wound photo timeline

**Flow.** Patient (Selma → Home → *Today*): *Take photo* → preview → optional note → *Send*. Clinician (Augi → chart → *Photo timeline*): thumbnails by date, open one to view, compare any two side by side, enter a manual measurement, or retract.

| Property | How |
|---|---|
| Metadata removed | The browser re-draws every photo onto a canvas and re-encodes JPEG (drops EXIF/GPS, applies rotation, caps at 1600 px). The server **re-validates and strips every metadata segment again** and never trusts the client. JPEG only. |
| Encrypted at rest | AES-256-GCM, a different key per organization derived (HKDF) from `PHOTO_ENCRYPTION_KEY`, ciphertext bound to its storage key (a blob copied to another row or org fails to decrypt). Optional S3 storage (`PHOTO_STORE=s3`) with SSE-KMS on top. |
| Same access rules as the chart | Patients: only their own. Clinicians: only assigned patients. Org admins and the super admin: no photo access. Failures are 404. Images are served `Cache-Control: no-store`. |
| Never hard-deleted | "Retract" hides a photo from the timeline with a required reason; the bytes and the row stay. |
| Audited | Added, viewed (once per 10 min per user/photo), measured, retracted: in the hash-chained audit log. |
| Measurement is manual | Clinician enters length × width (× depth). Area = L × W. **No image analysis**: automated measurement is FDA device territory (roadmap §07). |

**Limits to know:**
- `PHOTO_ENCRYPTION_KEY` is an environment variable, **not** an HSM/KMS-backed customer-managed key as the roadmap's security table specifies. Move to Azure Key Vault / AWS KMS envelope keys before real patient data at scale.
- Selma is a web app. A browser camera input cannot guarantee the photo never touches the phone's camera roll, and there is no push or Keychain storage; the roadmap's mobile-data rules need a PWA/native decision.
- Photos live in Postgres by default. Fine for 20–50 patients; switch to S3 (`PHOTO_STORE=s3`) after that. Switching does not migrate existing blobs.

## 2. Care pathways

A pathway is a dated protocol. Enrolling materializes its tasks, so later edits to a template never rewrite a patient's history.

- Built-in: **Post-op wound monitoring (30 days)**. Day 0 instructions and red-flag guidance, daily photo + Selma check-in for days 1–14, a photo every 3 days to day 30, a day-14 visit, and clinician review points.
- A photo upload completes that day's photo task; a Selma check-in completes the check-in task. Instruction/visit tasks are completed by the patient tapping *Got it*. Clinician tasks have a *Done* button.
- **Triage:** every 30 min the server looks for patients with photo/check-in tasks ≥ 2 days overdue and raises **one** alert (never more than one per 24 h per patient). Alerts are never auto-dismissed.
- Ending a pathway requires a reason; pending tasks are marked skipped, history is kept.

**Limits:** the template is **draft clinical content**; the instructions and the red-flag wording must be reviewed by your wound-care lead before real use. Templates live in code (`server/src/pathways.ts`); there is no in-app template editor yet. Scheduling is not built, so the day-14 visit is a reminder, not a booking. Education content is plain text inside tasks; the education library with delivery audit is a separate item.

## 3. Treatment ladder v1

Rule-based **decision support**: the clinician sees the suggestion, the facts that triggered it, and the sources, then decides.

- **Nothing fires until a clinician in the organization reviews and activates the rule** (*Review rules* on the ladder panel). Activation records who and when. Editing a threshold returns the rule to draft.
- A firing creates a suggestion with its evidence. **Accept** (optionally editing the text first) creates an order record with the rule, version, evidence and sources; **Dismiss** requires a reason. The system never accepts, dismisses or executes anything. Neither can a decision be made twice.
- Suggestions are recomputed when an assessment is recorded, a photo is measured, and every 30 min. A newer reading of the same rule replaces the older **open** suggestion; decided ones are untouched.
- Rules whose inputs the app doesn't capture (Braden, TcPO₂, MAP, Hgb, NPWT, osteomyelitis, NPIAP stage) are listed as *unavailable* and cannot be activated, rather than guessed.
- Safety guard: the nutrition rule shows a caution when the patient's history includes CKD/renal disease or heart failure (protein/fluid targets can be harmful there).

| Rule | Fires when (default threshold, editable) |
|---|---|
| Off-track healing | Area reduction < 20 % over ≥ 2 weeks |
| Escalate: advanced therapy | Area reduction < 50 % over ≥ 4 weeks |
| Infection work-up | Area reduction ≤ 0 % over ≥ 2 weeks |
| Vascular gate | ABI < 0.7 |
| Debridement task | Necrotic/slough tissue and ABI ≥ 0.7 documented |
| Nutrition review | Albumin ≤ 3.0 g/dL |
| Healing-risk labs | Albumin ≤ 2.8 g/dL |

Area series = formal assessments plus manually measured photos (an assessment wins on the same date).

**Important:** thresholds and citations are taken from the roadmap's knowledge-graph section. **They have not been independently verified**, and the roadmap itself says a wound-care clinician must review every rule before it drives care. The demo seed switches the rules on for the two demo organizations so you can see them; in a real organization every rule starts as a draft.

## Configuration

`PHOTO_ENCRYPTION_KEY` (required in production), `PHOTO_STORE`, `PHOTO_BUCKET`, `PHOTO_KMS_KEY_ID`, `PHOTO_MAX_BYTES`: see `server/.env.example`. On Render, set `PHOTO_ENCRYPTION_KEY` by hand (`openssl rand -base64 32`) and keep a copy.

## Tests

`server/test/photos_pathways.test.ts` (11 tests): metadata stripping, encryption and key binding, upload validation (type, corruption, size, foreign wound), cross-tenant/patient/admin isolation, measurement, retraction, pathway enrolment and completion rules, overdue computation, sweep dedupe, ladder firing/decisions, review-before-fire, and per-org rule isolation.
