# Notifications (replaces SMS for most uses)

Two layers, both in Augi (clinicians) and Selma (patients):

1. **In-app inbox** (bell icon). Always works. Refreshes live over the event stream, every minute, and on tab focus.
2. **Web push** (optional, per device). A short alert even when the app is closed.

## What triggers a notification
| Who | Kind | When |
|---|---|---|
| Clinician (care team) | `alert` | Patient alert raised (check-in, vitals, overdue pathway) |
| Clinician | `approval` | An Augi agent action is waiting for approval |
| Clinician | `ladder` | New treatment-ladder suggestions for a patient |
| Patient | `message` | Provider sent a message |
| Patient | `visit_started` | Provider started a video visit (urgent) |
| Patient | `task_reminder` | Once per local day at the chosen hour if tasks are open |

Users can mute any kind and set the reminder hour (Bell → Settings). Duplicates are suppressed for 24 h per key.

## Privacy
Push payloads are generic ("You have a new message"). No patient name or clinical detail ever leaves the server in a push; details are read in-app after sign-in. Sign-out removes the device's subscription so a shared phone doesn't receive the previous user's alerts. Subscriptions that the push service reports gone (404/410) are pruned automatically.

## Setup
```
npm run vapid -w server        # prints VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY
```
Set `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` (e.g. `mailto:ops@yourco.com`) on the Render API service. Without them the inbox still works and the bell says push isn't set up.

## Limits
- Push needs HTTPS and the user's permission; users can decline.
- iPhone/iPad: only after "Add to Home Screen" and opening from there (iOS 16.4+).
- Delivery is best-effort via the browser vendor's push service; it is not a guaranteed channel for critical escalations. Keep a phone/pager path for those.
- No email or SMS fallback is built. If you need SMS later, `notify()` is the single place to add a channel (and it needs a BAA-covered provider and patient consent).
