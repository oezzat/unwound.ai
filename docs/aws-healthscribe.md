# AWS HealthScribe + Comprehend Medical setup

> **Status:** the server-side HealthScribe client follows the `StartMedicalScribeStream` API as defined in the AWS SDK for JavaScript v3
> (`@aws-sdk/client-transcribe-streaming`) and is covered by tests that use a *fake* AWS client. **It has never been run against a real AWS
> account.** Do the sandbox checklist at the bottom before any real patient audio goes near it.

## How it works here

```
clinician browser ──(WebRTC)── patient browser
      │  mic (ch 0) + patient audio (ch 1) → 16 kHz stereo PCM, 100 ms chunks
      ▼  WebSocket  wss://<api>/ws/scribe?token=<2-min JWT>
 Render API ──HTTP/2──▶ AWS HealthScribe  StartMedicalScribeStream
      ▲  live TranscriptEvents (per channel) → saved as transcript turns in Postgres
      └─ at END_OF_SESSION: clinical note JSON written to S3 → read back and stored on the session
 Clinician reviews/edits transcript → "generate coding suggestions" → ICD-10/CPT draft with evidence quotes
```

* The scribe starts only when the **patient joined and explicitly consented** (server-enforced; consent + choice are written to the audit log).
* Only the clinician sees the transcript. Patients get a session object with no transcript.
* The **live transcript** captured from the stream is the source of truth for coding; the S3 clinical note is shown as reference only (its exact file
  names/schema aren't pinned down in the docs we could read, so the parser is defensive).
* Closing the WebSocket without ending **pauses** the AWS session; reconnecting with the same session id resumes it (AWS allows resuming within 5 h; 2 h of audio max).

## 1. S3 bucket for HealthScribe output
* Create a private bucket (block public access, default encryption; SSE-KMS recommended) — e.g. `my-org-healthscribe-output`.
* HealthScribe writes under `healthscribe-streaming/<session-id>/post-stream-analytics/clinical-notes`.
* Add a **lifecycle rule** to expire these objects (e.g. 30 days) — they contain PHI and the system of record is your database.

## 2. Role HealthScribe assumes to write to the bucket (`HEALTHSCRIBE_ROLE_ARN`)
Trust policy:
```json
{ "Version": "2012-10-17", "Statement": [{ "Effect": "Allow", "Principal": { "Service": ["transcribe.streaming.amazonaws.com"] }, "Action": "sts:AssumeRole" }] }
```
Permissions (add the KMS statement only if you use a customer-managed key, and set `HEALTHSCRIBE_KMS_KEY_ID`):
```json
{ "Version": "2012-10-17", "Statement": [
  { "Effect": "Allow", "Action": ["s3:PutObject"], "Resource": ["arn:aws:s3:::my-org-healthscribe-output", "arn:aws:s3:::my-org-healthscribe-output/*"] },
  { "Effect": "Allow", "Action": ["kms:DescribeKey","kms:Decrypt","kms:Encrypt","kms:GenerateDataKey*"], "Resource": "arn:aws:kms:REGION:ACCOUNT:key/KEY-ID" }
] }
```

## 3. Credentials the API server uses
Create an IAM user (or, better, an identity your host can assume) for the Render service with **only**:
```json
{ "Version": "2012-10-17", "Statement": [
  { "Effect": "Allow", "Action": ["transcribe:StartMedicalScribeStream"], "Resource": "*" },
  { "Effect": "Allow", "Action": ["iam:PassRole"], "Resource": "arn:aws:iam::ACCOUNT:role/healthscribe-output-writer", "Condition": { "StringEquals": { "iam:PassedToService": "transcribe.streaming.amazonaws.com" } } },
  { "Effect": "Allow", "Action": ["s3:ListBucket"], "Resource": "arn:aws:s3:::my-org-healthscribe-output", "Condition": { "StringLike": { "s3:prefix": ["healthscribe-streaming/*"] } } },
  { "Effect": "Allow", "Action": ["s3:GetObject"], "Resource": "arn:aws:s3:::my-org-healthscribe-output/healthscribe-streaming/*" },
  { "Effect": "Allow", "Action": ["comprehendmedical:InferICD10CM"], "Resource": "*" }
] }
```
(Verify the exact action names/conditions in the IAM console — AWS may name or scope them differently.)

## 4. Render environment variables
| Variable | Value |
|---|---|
| `SCRIBE_PROVIDER` | `aws` (`none` = video only; `mock` is for dev/tests and is **refused in production**) |
| `HEALTHSCRIBE_ROLE_ARN` | the role from step 2 |
| `HEALTHSCRIBE_OUTPUT_BUCKET` | bucket name (no `s3://`) |
| `HEALTHSCRIBE_KMS_KEY_ID` | optional |
| `HEALTHSCRIBE_NOTE_TEMPLATE` | default `PHYSICAL_SOAP` (others: `HISTORY_AND_PHYSICAL`, `GIRPP`, `DAP`, `SIRP`, `BIRP`, `BEHAVIORAL_SOAP`) |
| `AWS_REGION` | a region where HealthScribe is available |
| `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` | step 3 credentials — secrets, never commit |
| `CODING_PROVIDER` | `aws` to also run Comprehend Medical `InferICD10CM` over the transcript (chunked to stay under service limits) |

## 5. TURN (required for reliable video)
WebRTC video is peer-to-peer; users behind strict NAT/firewalls need a TURN relay. Run coturn (or use a TURN service) and set:
`TURN_URLS=turn:turn.example.com:3478?transport=udp,turns:turn.example.com:443?transport=tcp` and `TURN_SECRET=<coturn static-auth-secret>`
(the API then hands each user short-lived credentials — HMAC-SHA1 "TURN REST API" scheme, verified by a test). Alternatively `TURN_USERNAME` + `TURN_CREDENTIAL` for static credentials. Default STUN: Google's public server (`STUN_URLS` to change).

## 6. Sandbox checklist before real use
1. Set the env vars above in a **non-production** AWS account and Render service, with `SCRIBE_PROVIDER=aws`.
2. Run a visit between two browsers; confirm captions appear and that `telehealth_sessions.transcript` fills.
3. End the visit; confirm objects appear under `healthscribe-streaming/<session-id>/post-stream-analytics/clinical-notes/` and the review screen shows the AI note. If the note is empty, open the S3 files and adjust `parseClinicalNote()` in `server/src/scribe/aws.ts` to the real schema.
4. Check the channel→speaker mapping (0 = clinician mic, 1 = patient) against a real recording; if the stereo interleave expectation differs, adjust the worklet in `packages/shared/src/webrtc.ts`.
5. Confirm quota/concurrency limits and cost for your expected visit volume.
6. Get your BAA, retention and consent language reviewed by compliance/legal (consent wording and recording-consent laws vary by jurisdiction).
