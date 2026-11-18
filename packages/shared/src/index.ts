// ═══════════════════════════════════════════════════════════════════════════════
// @wc/shared — pure, dependency-free code used by the API server AND both
// frontends: event names, wound-assessment vocab, PUSH scoring, red-flag
// detection, and small helpers. Nothing in here touches the network or DB.
// ═══════════════════════════════════════════════════════════════════════════════

// ── Bridge channels (Selma ↔ Augi), delivered over SSE by the API ──────────────
export const CH = {
  SELMA_CHECKIN: "selma:checkin",
  SELMA_MESSAGE: "selma:message",
  SELMA_STEP_DONE: "selma:step_done",
  SELMA_ALERT: "selma:alert",
  SELMA_PHOTO: "selma:photo",
  SELMA_TELEHEALTH_JOIN: "selma:telehealth_join",
  AUGI_MESSAGE: "augi:message",
  AUGI_HITL: "augi:hitl_decision",
  AUGI_CARE_PLAN: "augi:care_plan_update",
  AUGI_ALERT_ACK: "augi:alert_ack",
  AUGI_TELEHEALTH_START: "augi:telehealth_start",
  AUGI_TELEHEALTH_END: "augi:telehealth_end",
  /** WebRTC signaling (SDP/ICE) between clinician and patient. Payload: { sessionId, from, kind, data }. */
  TELEHEALTH_SIGNAL: "telehealth:signal",
  /** Generic "this patient's record changed — refetch it". */
  STORE_UPDATED: "store:patient_updated",
  /** Per-USER signal "you have a new notification — refetch the count". Payload: { userId }. Only that user receives it. */
  NOTIFY: "notify:user",
} as const;

/** Channels a patient session is allowed to receive (clinician sees everything). */
export const PATIENT_VISIBLE_CHANNELS: string[] = [
  CH.AUGI_MESSAGE,
  CH.AUGI_CARE_PLAN,
  CH.AUGI_TELEHEALTH_START,
  CH.AUGI_TELEHEALTH_END,
  CH.TELEHEALTH_SIGNAL,
  CH.STORE_UPDATED,
  CH.NOTIFY,
];

// ── AG-UI protocol event types (agent run stream) ──────────────────────────────
export const EV = {
  RUN_STARTED: "RUN_STARTED",
  RUN_FINISHED: "RUN_FINISHED",
  RUN_ERROR: "RUN_ERROR",
  TEXT_START: "TEXT_MESSAGE_START",
  TEXT_CONTENT: "TEXT_MESSAGE_CONTENT",
  TEXT_END: "TEXT_MESSAGE_END",
  TOOL_START: "TOOL_CALL_START",
  TOOL_ARGS: "TOOL_CALL_ARGS",
  TOOL_END: "TOOL_CALL_END",
  NODE_ENTER: "GRAPH_NODE_ENTER",
  NODE_EXIT: "GRAPH_NODE_EXIT",
  HITL_REQUIRED: "HITL_REQUIRED",
  HITL_RESOLVED: "HITL_RESOLVED",
  HITL_REJECTED: "HITL_REJECTED",
  CHECKPOINT: "CHECKPOINT_SAVED",
  /** Deterministic (non-LLM) safety alert raised by the server. */
  SAFETY_ALERT: "SAFETY_ALERT",
} as const;

// ── Gated (human-approval) tool metadata, shared so UI + server agree ─────────
export const HITL_LABELS: Record<string, { icon: string; label: string; urgency: string }> = {
  send_to_patient: { icon: "message", label: "Send message to patient", urgency: "moderate" },
  escalate_to_ed: { icon: "siren", label: "Escalate to Emergency Department", urgency: "critical" },
  vascular_referral: { icon: "referral", label: "Vascular surgery referral", urgency: "high" },
  modify_care_plan: { icon: "plan", label: "Update care plan", urgency: "high" },
  request_labs: { icon: "labs", label: "Order lab tests", urgency: "moderate" },
};

// ── Wound assessment vocabulary ────────────────────────────────────────────────
export const WOUND_TYPES = [
  "Diabetic Foot Ulcer (DFU)", "Venous Leg Ulcer (VLU)", "Pressure Injury / Decubitus",
  "Surgical / Post-op Wound", "Arterial Ulcer", "Traumatic Wound / Laceration",
  "Burn Wound", "Malignant / Fungating Wound", "Mixed Etiology Ulcer",
] as const;
export const TISSUE_TYPES = ["Necrotic (Black)", "Slough (Yellow)", "Granulation (Red)", "Epithelial (Pink)", "Hypergranulation"] as const;
export const EXUDATE_TYPES = ["None", "Serous", "Serosanguineous", "Sanguineous", "Purulent"] as const;
export const EXUDATE_AMOUNTS = ["None", "Scant", "Minimal", "Moderate", "Heavy"] as const;
export const WOUND_EDGES = ["Attached", "Not attached", "Rolled/Epibole", "Fibrotic/Scarred", "Hyperkeratotic", "Macerated"] as const;
export const PERIWOUND_OPTIONS = ["Intact", "Macerated", "Erythema", "Induration", "Hyperpigmentation", "Edema", "Dermatitis"] as const;
export const PAIN_DESCRIPTORS = ["None", "Aching", "Burning", "Sharp", "Throbbing", "Stinging"] as const;
export const INFECTION_SIGN_OPTIONS = ["Erythema", "Warmth", "Edema", "Increased exudate", "Purulent drainage", "Odor", "Friable/bleeds easily", "Delayed healing", "Fever", "Pain increase", "Red streaks"] as const;
export const ASSESSMENT_METHODS = ["In-person", "Telehealth"] as const;
/** Procedures the clinician actually performed. CPT codes are derived ONLY from these (never inferred from findings). In-person only. */
export const PROCEDURE_OPTIONS = [
  "Selective debridement", "Excisional debridement (subcutaneous)", "Negative pressure wound therapy",
  "Multi-layer compression", "Unna boot",
] as const;

// ── PUSH Tool 3.0 scoring ──────────────────────────────────────────────────────
export function pushAreaScore(cm2: number): number {
  if (!cm2 || cm2 <= 0) return 0;
  if (cm2 < 0.3) return 1;
  if (cm2 <= 0.6) return 2;
  if (cm2 <= 1.0) return 3;
  if (cm2 <= 2.0) return 4;
  if (cm2 <= 3.0) return 5;
  if (cm2 <= 4.0) return 6;
  if (cm2 <= 8.0) return 7;
  if (cm2 <= 12.0) return 8;
  if (cm2 <= 24.0) return 9;
  return 10;
}
export function pushExudateScore(amount: string): number {
  return ({ None: 0, Scant: 1, Minimal: 1, Moderate: 2, Heavy: 3 } as Record<string, number>)[amount] ?? 0;
}
export function pushTissueScore(tissue: string): number {
  if (tissue.startsWith("Necrotic")) return 4;
  if (tissue.startsWith("Slough")) return 3;
  if (tissue.startsWith("Granulation") || tissue === "Hypergranulation") return 2;
  if (tissue.startsWith("Epithelial")) return 1;
  return 0;
}
export function computePush(a: { area: number; exudateAmount: string; tissueType: string }): number {
  return pushAreaScore(a.area) + pushExudateScore(a.exudateAmount) + pushTissueScore(a.tissueType || "");
}

// ── Deterministic red-flag detection ───────────────────────────────────────────
// This is the NON-LLM safety net for the patient chat: it runs on every patient
// message regardless of what the model decides to do. It is intentionally
// conservative (it will over-alert rather than under-alert); a clinician sees
// every hit. It is a backstop, not a diagnostic tool.
export type Severity = "critical" | "high" | "moderate";
const RED_FLAG_RULES: { term: string; re: RegExp; severity: Severity }[] = [
  { term: "chest pain", re: /chest (pain|pressure|tightness)/i, severity: "critical" },
  { term: "trouble breathing", re: /(short(ness)? of breath|can'?t breathe|trouble breathing|difficulty breathing)/i, severity: "critical" },
  { term: "fainting", re: /\b(faint(ed|ing)?|passed out|blacked out|unresponsive)\b/i, severity: "critical" },
  { term: "red streaks", re: /red (streak|line)s?|streaks? (going|up|spreading)/i, severity: "critical" },
  { term: "fever", re: /\b(fever|feverish|chills|temperature (of )?10[0-9])\b/i, severity: "high" },
  { term: "spreading redness/darkness", re: /(spread(ing)?|getting (bigger|larger|worse))|turn(ing|ed) black|black(ening)?\b/i, severity: "high" },
  { term: "pus / foul odor", re: /\b(pus|purulent|foul|smells? (bad|awful|terrible|rotten))\b/i, severity: "high" },
  { term: "numbness / cold limb", re: /\b(numb(ness)?|can'?t feel|cold (foot|leg|toe)|foot (is )?cold)\b/i, severity: "high" },
  { term: "dizziness", re: /\b(dizzy|lightheaded|light-headed)\b/i, severity: "moderate" },
  { term: "uncontrolled bleeding", re: /(bleeding (won'?t|will not|doesn'?t) stop|soaking through)/i, severity: "high" },
];
const NEGATION = /\b(no|not|without|denies|don'?t have|do not have|never|haven'?t had|zero)\s+(any\s+|a\s+)?(\w+\s+){0,2}$/i;

export function detectRedFlags(text: string): { term: string; severity: Severity }[] {
  const hits: { term: string; severity: Severity }[] = [];
  for (const rule of RED_FLAG_RULES) {
    const m = rule.re.exec(text);
    if (!m) continue;
    const before = text.slice(Math.max(0, m.index - 24), m.index);
    if (NEGATION.test(before)) continue; // "no fever", "without any chest pain"
    hits.push({ term: rule.term, severity: rule.severity });
  }
  return hits;
}
export function topSeverity(hits: { severity: Severity }[]): Severity | null {
  if (hits.some(h => h.severity === "critical")) return "critical";
  if (hits.some(h => h.severity === "high")) return "high";
  if (hits.length) return "moderate";
  return null;
}

// ── Small helpers ──────────────────────────────────────────────────────────────
export function nowStr(): string {
  return new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}
export function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}
export const urgColor = (u: string) =>
  ({ critical: "#cf222e", high: "#bc4c00", moderate: "#9a6700", low: "#1a7f37" } as Record<string, string>)[u] || "#57606a";
export const urgBg = (u: string) =>
  ({ critical: "rgba(207,34,46,.1)", high: "rgba(188,76,0,.1)", moderate: "rgba(154,103,0,.1)", low: "rgba(26,127,55,.1)" } as Record<string, string>)[u] || "rgba(87,96,106,.1)";
export function nid(): string {
  return Math.random().toString(36).slice(2, 8);
}

// ── API payload types (loose on purpose: the UI is JS-style) ───────────────────
/** super_admin = platform operator (no org); org_admin = manages one org's staff/patients (no clinical access);
 *  clinician = clinical access ONLY to patients assigned to them within their org; patient = own record only. */
export type Role = "super_admin" | "org_admin" | "clinician" | "patient";
export interface SessionUser { id: string; role: Role; name: string; patientId: string | null; email: string; orgId: string | null }
export * from "./client";
