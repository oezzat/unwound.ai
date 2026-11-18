// @ts-nocheck
import { useState, useEffect, useRef, useCallback, useReducer, createContext, useContext } from "react";
import { Ic } from "@wc/shared/icons";
import {
  CH, EV, nid, nowStr, urgColor,
  WOUND_TYPES, TISSUE_TYPES, EXUDATE_TYPES, EXUDATE_AMOUNTS,
  WOUND_EDGES, PERIWOUND_OPTIONS, PAIN_DESCRIPTORS, INFECTION_SIGN_OPTIONS, ASSESSMENT_METHODS, PROCEDURE_OPTIONS,
  computePush, HITL_LABELS,
} from "@wc/shared";
import { VideoCall, ScribeCapture } from "@wc/shared/webrtc";
import { api, bridge, login, session, setOnUnauthorized, AugiClient, API_URL } from "./api";
import AdminConsole from "./AdminConsole";
import { UI_BASE_CSS } from "@wc/shared/ui";
import { POLISH_CSS, NAVY_CSS } from "./polish";
import { CarePanels, CARE_CSS } from "./CarePanels";
import { clearImageCache } from "@wc/shared/photo";
import { NotificationBell, NOTIF_CSS, disablePush } from "@wc/shared/notifications";

// Clinician half of the platform. All data comes from the API server (Render); the Selma agent runs
// server-side and streams over SSE. Human-in-the-loop approvals are durable in Postgres.

const BridgeCtx = createContext(null);
/** Makes a clickable <div> keyboard-operable (Enter/Space) and announced as a button. */
const kb = (fn) => ({ role:"button", tabIndex:0, onClick:fn, onKeyDown:(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); fn(e); } } });
const useBridge = () => useContext(BridgeCtx);

const css = UI_BASE_CSS + `

/* ── LAYOUT: 3-col ── */
.app{display:grid;grid-template-columns:220px 1fr 420px;grid-template-rows:48px 1fr;height:100vh;overflow:hidden}
.topbar{grid-column:1/-1;background:var(--s1);border-bottom:1px solid var(--bd);display:flex;align-items:center;justify-content:space-between;padding:0 16px;gap:10px;flex-shrink:0}
.tb-brand{display:flex;align-items:center;gap:10px;font-weight:700;font-size:14px}
.brand-logo{height:20px;width:auto;display:block}.tb-div{width:1px;height:18px;background:var(--bd2)}.tb-prod{white-space:nowrap}
@media (max-width:640px){.tb-div,.tb-prod{display:none}}
.live-dot{width:7px;height:7px;border-radius:50%;background:var(--grn);animation:pulse 2s infinite;flex-shrink:0}
.pill{font-size:11px;font-weight:700;padding:2px 7px;border-radius:10px;border:1px solid;white-space:nowrap}
.p-pur{background:rgba(130,80,223,.08);border-color:rgba(130,80,223,.25);color:var(--pur)}
.p-grn{background:rgba(26,127,55,.08);border-color:rgba(26,127,55,.25);color:var(--grn)}
.p-blu{background:rgba(9,105,218,.08);border-color:rgba(9,105,218,.25);color:var(--acc)}
.p-red{background:rgba(207,34,46,.08);border-color:rgba(207,34,46,.3);color:var(--red)}

/* ── PATIENT SIDEBAR ── */
.sidebar{background:var(--s1);border-right:1px solid var(--bd);overflow-y:auto;display:flex;flex-direction:column}
.nav-row{padding:8px 10px;border-bottom:1px solid var(--bd);flex-shrink:0}
.nav-btn{display:flex;align-items:center;gap:8px;padding:8px 10px;border-radius:7px;font-size:12px;font-weight:600;color:var(--tx2);cursor:pointer;transition:var(--t)}
.nav-btn:hover{background:var(--s3);color:var(--tx)}
.nav-btn.navsel{background:rgba(9,105,218,.08);color:var(--acc)}
.sh{padding:8px 12px;border-bottom:1px solid var(--bd);font-size:11px;font-weight:700;color:var(--tx3);text-transform:uppercase;letter-spacing:.07em;flex-shrink:0}
.pt{padding:9px 12px;border-bottom:1px solid var(--bd);cursor:pointer;transition:background .12s}
.pt:hover{background:var(--s2)}
.pt.sel{background:var(--s3);border-left:2px solid var(--acc);padding-left:10px}
.bdg{display:inline-flex;align-items:center;font-size:11px;font-weight:700;padding:1px 6px;border-radius:10px;white-space:nowrap}
.bc{background:rgba(207,34,46,.12);color:var(--red)}.bh{background:rgba(188,76,0,.12);color:var(--org)}.bm{background:rgba(154,103,0,.12);color:var(--yel)}.bl{background:rgba(26,127,55,.12);color:var(--grn)}.bir{background:rgba(9,105,218,.1);color:var(--acc)}.bs{background:var(--s4);color:var(--tx2)}
.adh{height:3px;background:var(--s4);border-radius:2px;overflow:hidden;margin-top:5px}
.adh-f{height:100%;border-radius:2px}

/* ── MAIN PATIENT VIEW ── */
.main{overflow-y:auto;display:flex;flex-direction:column;background:var(--bg)}
.pt-hero{background:var(--s1);border-bottom:1px solid var(--bd);padding:14px 16px;flex-shrink:0}
.alerts-strip{background:var(--s2);border-bottom:1px solid var(--bd);padding:8px 16px;display:flex;flex-direction:column;gap:4px;flex-shrink:0}
.ar{display:flex;align-items:flex-start;gap:7px;padding:6px 10px;border-radius:6px;border:1px solid;font-size:11px}
.arc{background:rgba(207,34,46,.08);border-color:rgba(207,34,46,.28);color:var(--red)}
.arh{background:rgba(188,76,0,.08);border-color:rgba(188,76,0,.28);color:var(--org)}
.arm{background:rgba(154,103,0,.08);border-color:rgba(154,103,0,.28);color:var(--yel)}
.cards{display:grid;grid-template-columns:1fr 1fr;gap:9px;padding:12px 16px}
.card{background:var(--s1);border:1px solid var(--bd);border-radius:var(--r);padding:11px;box-shadow:0 1px 2px rgba(31,35,40,.04)}

/* ── DASHBOARD VIEW ── */
.dash{padding:16px}
.dash-hdr{margin-bottom:14px}
.dash-title{font-size:18px;font-weight:700;color:var(--tx);margin-bottom:2px}
.dash-sub{font-size:11px;color:var(--tx2)}
.stat-row{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:16px}
.stat-card{background:var(--s1);border:1px solid var(--bd);border-radius:var(--r);padding:12px 14px;box-shadow:0 1px 2px rgba(31,35,40,.04)}
.stat-num{font-size:22px;font-weight:700;color:var(--tx);line-height:1.1}
.stat-lbl{font-size:11px;color:var(--tx2);margin-top:3px;text-transform:uppercase;letter-spacing:.05em;font-weight:600}
.dash-section-lbl{font-size:11px;font-weight:700;color:var(--tx3);text-transform:uppercase;letter-spacing:.06em;margin:4px 0 8px}
.dash-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:10px}
.dcard{background:var(--s1);border:1px solid var(--bd);border-radius:var(--r);padding:12px;cursor:pointer;transition:var(--t);box-shadow:0 1px 2px rgba(31,35,40,.04)}
.dcard:hover{border-color:var(--acc);box-shadow:0 2px 8px rgba(9,105,218,.1)}
.dcard-top{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:6px}
.dcard-name{font-size:13px;font-weight:700;color:var(--tx)}
.dcard-meta{font-size:11px;color:var(--tx2);margin-bottom:6px}
.dcard-alert{font-size:11px;color:var(--red);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;margin-bottom:6px}
.dcard-btn{display:inline-flex;align-items:center;gap:4px;font-size:11px;font-weight:700;color:var(--acc);margin-top:2px}

/* ── TELEHEALTH VIEW ── */
.th{padding:16px;display:flex;flex-direction:column;gap:12px;flex:1}
.th-topbar{display:flex;justify-content:space-between;align-items:center}
.th-status{display:flex;align-items:center;gap:7px;font-size:12px;font-weight:600;color:var(--tx)}
.th-rec-dot{width:8px;height:8px;border-radius:50%;background:var(--red);animation:pulse 1.2s infinite}
.th-timer{font-family:'JetBrains Mono',monospace;font-size:12px;color:var(--tx2)}
.th-tiles{display:grid;grid-template-columns:1fr 1fr;gap:12px;flex:1}
.th-tile{background:#0d1117;border-radius:12px;position:relative;overflow:hidden;display:flex;align-items:center;justify-content:center;min-height:220px;border:1px solid var(--bd)}
.th-tile-label{position:absolute;bottom:8px;left:10px;font-size:11px;color:#fff;background:rgba(0,0,0,.45);padding:3px 8px;border-radius:12px;font-weight:600}
.th-avatar{width:76px;height:76px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:26px;font-weight:700;color:#fff}
.th-self{position:absolute;bottom:10px;right:10px;width:84px;height:60px;background:#1f2328;border-radius:8px;border:2px solid rgba(255,255,255,.25);display:flex;align-items:center;justify-content:center;color:#fff;font-size:11px}
.th-video{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;background:#0d1117}
.th-selfvid{position:absolute;bottom:10px;right:10px;width:96px;height:72px;object-fit:cover;border-radius:8px;border:2px solid rgba(255,255,255,.35);background:#1f2328;transform:scaleX(-1)}
.th-caps{display:flex;flex-direction:column;align-items:stretch;justify-content:flex-start;background:#0d1117;padding:10px;gap:8px}
.th-caps-hdr{display:flex;gap:6px;flex-wrap:wrap}
.th-caps-body{flex:1;overflow-y:auto;display:flex;flex-direction:column;gap:6px}
.th-cap{font-size:12px;color:#e6edf3;line-height:1.45}.th-cap.partial{opacity:.55}
.th-cap b{font-size:11px;text-transform:uppercase;letter-spacing:.04em;margin-right:4px}.th-cap b.clinician{color:#7ee787}.th-cap b.patient{color:#79c0ff}
.rv-turns{display:flex;flex-direction:column;gap:6px}
.rv-turn{display:flex;gap:8px;align-items:flex-start;background:var(--s1);border:1px solid var(--bd);border-radius:8px;padding:7px 9px}
.rv-turn textarea{flex:1;border:1px solid transparent;background:transparent;font:inherit;font-size:12px;resize:vertical;color:var(--tx);padding:2px 4px}.rv-turn textarea:focus{border-color:var(--bd2);background:var(--s2);outline:none}
.rv-who{flex:0 0 62px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;padding-top:5px}.rv-who.clinician{color:var(--grn)}.rv-who.patient{color:var(--acc)}
.bill-ev{grid-column:1/-1;margin:3px 0 0 26px;font-size:11px;color:var(--tx2)}.bill-ev .bill-q{display:block;margin-top:2px;padding-left:8px;border-left:2px solid var(--bd2);font-style:italic}
.th-controls{display:flex;justify-content:center;gap:10px;padding:10px 0}
.th-ctrl-btn{width:44px;height:44px;border-radius:50%;border:1px solid var(--bd);background:var(--s1);display:flex;align-items:center;justify-content:center;font-size:16px;cursor:pointer;transition:var(--t);box-shadow:0 1px 2px rgba(31,35,40,.06)}
.th-ctrl-btn:hover{background:var(--s3)}
.th-ctrl-btn.off{background:rgba(207,34,46,.1);border-color:rgba(207,34,46,.3);color:var(--red)}
.th-ctrl-btn.end{background:var(--red);border-color:var(--red);color:#fff}
.th-ctrl-btn.end:hover{background:#a40e26}
.th-notes{background:var(--s1);border:1px solid var(--bd);border-radius:var(--r);padding:11px}
.th-launch-btn{background:var(--grn);color:#fff;border:none;border-radius:8px;padding:7px 13px;font-size:11px;font-weight:700;cursor:pointer;font-family:inherit;transition:var(--t);white-space:nowrap}
.th-launch-btn:hover{background:#166a2e}
.th-assess-btn{background:rgba(130,80,223,.1);color:var(--pur);border:1px solid rgba(130,80,223,.3);border-radius:8px;padding:8px 12px;font-size:11px;font-weight:700;cursor:pointer;font-family:inherit;transition:var(--t)}
.th-assess-btn:hover{background:rgba(130,80,223,.18)}

/* ── WOUNDS SECTION (patient subpage) ── */
.wounds-sec{padding:0 16px 4px}
.wounds-sec-hdr{display:flex;justify-content:space-between;align-items:center;margin-bottom:8px}
.add-wound-btn{background:var(--s1);border:1px dashed var(--bd2);color:var(--acc);border-radius:8px;padding:6px 12px;font-size:11px;font-weight:700;cursor:pointer;font-family:inherit;transition:var(--t)}
.add-wound-btn:hover{background:rgba(9,105,218,.06);border-color:var(--acc)}
.wound-card{background:var(--s1);border:1px solid var(--bd);border-radius:var(--r);padding:12px;margin-bottom:8px;box-shadow:0 1px 2px rgba(31,35,40,.04)}
.wound-card-hdr{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:6px;gap:8px;flex-wrap:wrap}
.wound-name{font-size:12px;font-weight:700;color:var(--tx)}
.wound-loc{font-size:11px;color:var(--tx2)}
.wound-actions{display:flex;gap:6px;flex-shrink:0}
.wound-btn{border:1px solid var(--bd);background:var(--s1);color:var(--tx2);border-radius:6px;padding:4px 9px;font-size:11px;font-weight:700;cursor:pointer;font-family:inherit;transition:var(--t);white-space:nowrap}
.wound-btn:hover{background:var(--s3)}
.wound-btn.primary{background:rgba(9,105,218,.08);border-color:rgba(9,105,218,.3);color:var(--acc)}
.wound-btn.primary:hover{background:rgba(9,105,218,.15)}
.wound-hist{margin-top:8px;border-top:1px solid var(--bd);padding-top:8px}
.wound-hist-row{display:flex;justify-content:space-between;align-items:center;font-size:11px;color:var(--tx2);padding:3px 0}
.wound-hist-row b{color:var(--tx)}

/* ── MODALS: assessment / add wound ── */
.modal-backdrop{position:fixed;inset:0;background:rgba(15,23,42,.45);display:flex;align-items:center;justify-content:center;z-index:60;padding:20px}
.modal-panel{background:var(--s1);border-radius:14px;max-width:600px;width:100%;max-height:88vh;overflow-y:auto;padding:20px 22px;box-shadow:0 12px 34px rgba(15,23,42,.28)}
.modal-hdr{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:14px}
.modal-title{font-size:15px;font-weight:700;color:var(--tx)}
.modal-sub{font-size:11px;color:var(--tx2);margin-top:2px}
.modal-close{background:none;border:none;font-size:16px;color:var(--tx3);cursor:pointer;line-height:1}
.af-row{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px}
.af-field{margin-bottom:12px}
.af-label{font-size:11px;font-weight:700;color:var(--tx3);text-transform:uppercase;letter-spacing:.05em;margin-bottom:5px}
.af-field input,.af-field select,.af-field textarea{width:100%;background:var(--s1);border:1px solid var(--bd2);border-radius:7px;padding:8px 10px;color:var(--tx);font-family:'DM Sans',sans-serif;font-size:12px;outline:none;resize:vertical}
.af-field input:focus,.af-field select:focus,.af-field textarea:focus{border-color:var(--pur)}
.af-method-row{display:flex;gap:8px}
.af-method-btn{flex:1;padding:8px;border-radius:7px;border:1px solid var(--bd2);background:var(--s1);color:var(--tx2);font-size:11px;font-weight:700;cursor:pointer;font-family:inherit;text-align:center;transition:var(--t)}
.af-method-btn.sel{background:rgba(130,80,223,.08);border-color:var(--pur);color:var(--pur)}
.af-chip-grid{display:flex;flex-wrap:wrap;gap:6px}
.af-chip{padding:5px 10px;border-radius:14px;border:1px solid var(--bd2);background:var(--s1);color:var(--tx2);font-size:11px;cursor:pointer;font-family:inherit;transition:var(--t)}
.af-chip.sel{background:rgba(207,34,46,.08);border-color:var(--red);color:var(--red)}
.af-push-preview{background:var(--s3);border-radius:8px;padding:10px 12px;display:flex;justify-content:space-between;align-items:center;margin-bottom:14px}
.af-push-num{font-size:20px;font-weight:700;color:var(--tx)}
.af-btns{display:flex;gap:8px;margin-top:6px}
.af-save{flex:2;padding:10px;border:none;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit;color:#fff;background:var(--grn)}
.af-save:hover{background:#166a2e}
.af-cancel{flex:1;padding:10px;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit;background:transparent;border:1px solid var(--bd2);color:var(--tx2)}
.af-cancel:hover{background:var(--s3)}

/* ── BILLING & AUDIT VIEW ── */
.bill-tabs{display:flex;gap:4px;border-bottom:1px solid var(--bd);margin-bottom:14px}
.bill-tab{padding:8px 14px;font-size:11px;font-weight:700;color:var(--tx2);cursor:pointer;border-bottom:2px solid transparent;transition:var(--t)}
.bill-tab:hover{color:var(--tx)}
.bill-tab.sel{color:var(--acc);border-color:var(--acc)}
.bill-card{background:var(--s1);border:1px solid var(--bd);border-radius:var(--r);padding:13px;margin-bottom:10px;box-shadow:0 1px 2px rgba(31,35,40,.04)}
.bill-card-hdr{display:flex;justify-content:space-between;align-items:flex-start;gap:8px;margin-bottom:8px;flex-wrap:wrap}
.bill-card-title{font-size:12px;font-weight:700;color:var(--tx)}
.bill-status{font-size:11px;font-weight:700;padding:3px 8px;border-radius:10px;white-space:nowrap}
.bill-status.pending{background:rgba(154,103,0,.1);color:var(--yel)}
.bill-status.approved{background:rgba(26,127,55,.1);color:var(--grn)}
.bill-status.rejected{background:rgba(207,34,46,.1);color:var(--red)}
.bill-toggle{font-size:11px;color:var(--acc);cursor:pointer;font-weight:600;margin-bottom:8px}
.bill-transcript{background:var(--s3);border-radius:8px;padding:10px 12px;margin-bottom:10px}
.bill-transcript-text{font-size:11px;color:var(--tx2);white-space:pre-wrap;line-height:1.7;font-family:'JetBrains Mono',monospace;margin-bottom:8px}
.bill-entities{display:flex;flex-wrap:wrap;gap:5px}
.bill-entity-chip{font-size:11px;background:rgba(130,80,223,.08);border:1px solid rgba(130,80,223,.2);color:var(--pur);border-radius:10px;padding:3px 8px}
.bill-entity-chip b{color:var(--tx2);font-weight:700;margin-left:3px}
.bill-codes{display:flex;flex-direction:column;gap:8px}
.bill-code-row{display:grid;grid-template-columns:auto auto auto 1fr auto;align-items:center;gap:8px;background:var(--s3);border-radius:8px;padding:8px 10px}
.bill-code-type{font-size:11px;font-weight:700;padding:2px 6px;border-radius:5px;letter-spacing:.03em}
.bill-code-type.icd{background:rgba(9,105,218,.12);color:var(--acc)}
.bill-code-type.cpt{background:rgba(130,80,223,.12);color:var(--pur)}
.bill-code-num{font-family:'JetBrains Mono',monospace;font-size:11px;font-weight:700;color:var(--tx)}
.bill-code-desc{font-size:11px;color:var(--tx2);grid-column:4}
.bill-code-conf{font-size:11px;font-weight:700}
.bill-code-reason{grid-column:1/-1;font-size:11px;color:var(--tx3);padding-top:4px;border-top:1px dashed var(--bd);margin-top:2px;line-height:1.5}
.audit-log{display:flex;flex-direction:column;gap:0}
.audit-log-row{display:flex;justify-content:space-between;align-items:flex-start;gap:10px;padding:10px 0;border-bottom:1px solid var(--bd)}
.audit-log-event{font-size:11.5px;font-weight:700;color:var(--tx)}
.audit-log-detail{font-size:11px;color:var(--tx2);margin-top:2px}
.audit-log-meta{text-align:right;font-size:11px;color:var(--tx3);flex-shrink:0;line-height:1.6}
.audit-hash{font-family:'JetBrains Mono',monospace;color:var(--tx3);opacity:.7}
.bill-launch-btn{background:var(--acc);color:#fff;border:none;border-radius:8px;padding:7px 13px;font-size:11px;font-weight:700;cursor:pointer;font-family:inherit;transition:var(--t);white-space:nowrap}
.bill-launch-btn:hover{background:#0757ba}
.cf{grid-column:1/-1}
.ct{font-size:11px;font-weight:700;color:var(--tx3);text-transform:uppercase;letter-spacing:.06em;margin-bottom:7px}
.kv{display:flex;justify-content:space-between;align-items:baseline;margin-bottom:4px;gap:6px}
.kk{font-size:11px;color:var(--tx2)}.kv-v{font-size:11px;font-weight:600}
.ok{color:var(--grn)}.warn{color:var(--yel)}.danger{color:var(--red)}.muted{color:var(--tx3)}
.pb{height:4px;background:var(--s3);border-radius:3px;overflow:hidden;margin-top:2px}
.pf{height:100%;border-radius:3px}
.ci-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:6px}
.ci-q{background:var(--s3);border-radius:5px;padding:6px 8px}
.ci-l{font-size:11px;color:var(--pur);font-weight:700;text-transform:uppercase;letter-spacing:.05em;margin-bottom:1px}
.ci-a{font-size:11px;color:var(--tx);line-height:1.4}

/* ══════════════════════════════════════════════
   UNIFIED AUGI + BRIDGE PANEL
══════════════════════════════════════════════ */
.augi-panel{background:var(--s1);border-left:1px solid var(--bd);display:flex;flex-direction:column;overflow:hidden}

/* Header */
.ap-hdr{padding:11px 14px;border-bottom:1px solid var(--bd);display:flex;align-items:center;gap:9px;flex-shrink:0}
.augi-av{width:32px;height:32px;border-radius:50%;overflow:hidden;display:flex;align-items:center;justify-content:center;flex-shrink:0}.augi-av img{width:100%;height:100%;object-fit:cover;display:block}
.ap-meta{flex:1}
.ap-name{font-size:13px;font-weight:700;color:var(--pur)}
.ap-sub{font-size:11px;color:var(--tx3)}
.ap-badges{display:flex;gap:5px;align-items:center}

@keyframes hpulse{0%,100%{opacity:1}50%{opacity:.5}}

/* Active tool bar */
.tool-bar{padding:5px 10px;background:var(--bg);border-bottom:1px solid var(--bd);display:flex;flex-wrap:wrap;gap:4px;flex-shrink:0}
.tool-pill{display:flex;align-items:center;gap:5px;padding:3px 8px;background:rgba(130,80,223,.07);border:1px solid rgba(130,80,223,.2);border-radius:14px;font-size:11px;color:var(--pur)}
.tspin{width:8px;height:8px;border:1.5px solid rgba(130,80,223,.2);border-top-color:var(--pur);border-radius:50%;animation:spin .7s linear infinite}

/* ── UNIFIED TIMELINE ── */
.timeline{flex:1;overflow-y:auto;padding:10px 12px;display:flex;flex-direction:column;gap:0}

/* Every timeline entry */
.tl-entry{display:flex;gap:8px;margin-bottom:12px;animation:fadeUp .25s ease}
.tl-icon-col{display:flex;flex-direction:column;align-items:center;width:28px;flex-shrink:0}
.tl-dot{width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:13px;flex-shrink:0;border:1.5px solid}
.tl-line{width:1px;flex:1;min-height:8px;background:var(--bd);margin:3px auto}
.tl-body{flex:1;min-width:0;padding-top:4px}
.tl-meta{font-size:11px;color:var(--tx3);margin-bottom:4px;display:flex;align-items:center;gap:5px;font-family:'JetBrains Mono',monospace}
.tl-source{font-weight:700;letter-spacing:.03em}

/* ── BRIDGE CARDS (Selma→Selma) ── */
.bridge-card{border-radius:10px;padding:9px 11px;border:1px solid;margin-bottom:0}
.bc-selma-msg{background:rgba(130,80,223,.04);border-color:rgba(130,80,223,.2)}
.bc-selma-ci{background:rgba(130,80,223,.06);border-color:rgba(130,80,223,.25)}
.bc-selma-step{background:rgba(26,127,55,.04);border-color:rgba(26,127,55,.2)}
.bc-selma-alert{background:rgba(207,34,46,.07);border-color:rgba(207,34,46,.3)}
.bc-label{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px;display:flex;align-items:center;gap:5px}
.bc-content{font-size:11px;color:var(--tx2);line-height:1.5}
.bc-actions{display:flex;gap:5px;margin-top:7px;flex-wrap:wrap}
.bc-btn{padding:4px 10px;border-radius:6px;font-size:11px;font-weight:700;cursor:pointer;border:none;font-family:inherit;transition:var(--t)}
.bc-btn-g{background:rgba(35,134,54,.8);color:white}.bc-btn-g:hover{background:#238636}
.bc-btn-r{background:transparent;border:1px solid rgba(207,34,46,.4)!important;color:var(--red)}.bc-btn-r:hover{background:rgba(207,34,46,.1)}
.bc-btn-b{background:rgba(9,105,218,.1);color:var(--acc);border:1px solid rgba(9,105,218,.2)}.bc-btn-b:hover{background:rgba(9,105,218,.18)}
.bc-btn-p{background:rgba(130,80,223,.1);color:var(--pur);border:1px solid rgba(130,80,223,.2)}.bc-btn-p:hover{background:rgba(130,80,223,.18)}
.ci-mini-grid{display:grid;grid-template-columns:1fr 1fr 1fr;gap:5px;margin-top:6px}
.ci-mini{background:var(--s3);border-radius:5px;padding:5px 7px}
.ci-mini-l{font-size:11px;color:var(--pur);font-weight:700;text-transform:uppercase;letter-spacing:.04em;margin-bottom:1px}
.ci-mini-v{font-size:11px;color:var(--tx)}

/* ── AUGI TEXT MESSAGES ── */
.augi-msg{background:rgba(130,80,223,.06);border:1px solid rgba(130,80,223,.13);border-radius:10px;padding:9px 11px;font-size:11px;line-height:1.65;color:var(--tx);white-space:pre-wrap}
.augi-streaming{border-style:dashed}
.cursor{display:inline-block;width:2px;height:11px;background:var(--pur);margin-left:2px;animation:blink .7s infinite;vertical-align:middle}
@keyframes blink{0%,100%{opacity:1}50%{opacity:0}}

/* ── USER MESSAGES ── */
.user-msg{background:rgba(9,105,218,.75);border-radius:10px;padding:8px 11px;font-size:11px;line-height:1.55;color:white;align-self:flex-end;max-width:88%}

/* ── HITL INTERCESSION CARDS ── */
.hitl-card{border-radius:10px;padding:10px 12px;border:1.5px solid;animation:fadeUp .3s ease}
.hitl-critical{background:rgba(207,34,46,.06);border-color:rgba(207,34,46,.4)}
.hitl-high{background:rgba(188,76,0,.06);border-color:rgba(188,76,0,.35)}
.hitl-moderate{background:rgba(9,105,218,.06);border-color:rgba(9,105,218,.3)}
.hitl-hdr{display:flex;align-items:center;gap:7px;margin-bottom:6px}
.hitl-icon{font-size:16px}
.hitl-label{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.05em}
.hitl-node{font-size:11px;font-family:'JetBrains Mono',monospace;color:var(--tx3);margin-top:1px}
.hitl-field{margin-bottom:8px}
.hitl-field-label{font-size:11px;font-weight:700;color:var(--tx3);text-transform:uppercase;letter-spacing:.05em;margin-bottom:3px}
.hitl-field textarea,.hitl-field input,.hitl-field select{width:100%;background:var(--s3);border:1px solid var(--bd2);border-radius:6px;padding:7px 10px;color:var(--tx);font-family:'DM Sans',sans-serif;font-size:11px;outline:none;resize:vertical}
.hitl-field textarea:focus,.hitl-field input:focus,.hitl-field select:focus{border-color:var(--pur)}
.hitl-field select option{background:var(--s3)}
.hitl-btns{display:flex;gap:6px;margin-top:8px}
.hitl-approve{flex:2;padding:8px;border:none;border-radius:7px;font-size:11px;font-weight:700;cursor:pointer;font-family:inherit;color:white;transition:var(--t)}
.hitl-reject{flex:1;padding:8px;border-radius:7px;font-size:11px;font-weight:700;cursor:pointer;font-family:inherit;background:transparent;border:1px solid rgba(207,34,46,.4);color:var(--red)}
.hitl-reject:hover{background:rgba(207,34,46,.1)}
.hitl-note-row{margin-top:6px}
.hitl-note{width:100%;background:var(--s3);border:1px solid var(--bd);border-radius:6px;padding:6px 10px;color:var(--tx2);font-family:'DM Sans',sans-serif;font-size:11px;outline:none;resize:none}
.hitl-footer{font-size:11px;color:var(--tx3);text-align:center;margin-top:5px}

/* ── PENDING HITL BANNER ── */
.hitl-banner{background:rgba(207,34,46,.07);border-bottom:1px solid rgba(207,34,46,.25);padding:6px 12px;display:flex;align-items:center;gap:8px;cursor:pointer;transition:background .15s;flex-shrink:0}
.hitl-banner:hover{background:rgba(207,34,46,.12)}

/* ── AUDIT LOG ── */
.audit-entry{display:flex;align-items:center;gap:7px;padding:5px 8px;background:var(--s3);border-radius:6px;margin-bottom:4px}
.audit-icon{font-size:12px}
.audit-text{font-size:11px;color:var(--tx2);flex:1}
.audit-time{font-size:11px;color:var(--tx3);font-family:'JetBrains Mono',monospace;flex-shrink:0}
.audit-ok{color:var(--grn)}.audit-no{color:var(--red)}

/* ── INPUT AREA ── */
.inp-area{border-top:1px solid var(--bd);padding:9px 11px;flex-shrink:0}
.qbs{display:flex;flex-wrap:wrap;gap:4px;margin-bottom:7px}
.qb{padding:3px 8px;border-radius:10px;border:1px solid rgba(130,80,223,.22);background:rgba(130,80,223,.06);color:var(--pur);font-size:11px;cursor:pointer;font-family:inherit;transition:var(--t)}
.qb:hover{background:rgba(130,80,223,.14)}.qb:disabled{opacity:.4;cursor:not-allowed}
.inp-row{display:flex;gap:6px}
.augi-inp{flex:1;background:var(--s2);border:1px solid var(--bd2);border-radius:18px;padding:8px 13px;color:var(--tx);font-size:11px;font-family:inherit;outline:none;resize:none;max-height:80px}
.augi-inp:focus{border-color:var(--pur)}
.send-btn{width:34px;height:34px;border-radius:50%;background:linear-gradient(135deg,#6d28d9,#9333ea);border:none;cursor:pointer;color:white;font-size:13px;display:flex;align-items:center;justify-content:center;flex-shrink:0;transition:transform .12s}
.send-btn:hover{transform:scale(1.06)}.send-btn:disabled{opacity:.4;cursor:not-allowed;transform:none}
.inp-footer{font-size:11px;color:var(--tx3);text-align:center;margin-top:5px}

/* typing */
.typing{display:flex;gap:3px;align-items:center;padding:8px 11px;background:rgba(130,80,223,.06);border:1px solid rgba(130,80,223,.1);border-radius:10px;width:fit-content}
.d{width:4px;height:4px;border-radius:50%;background:var(--pur);animation:bncx 1.2s infinite}
.d:nth-child(2){animation-delay:.2s}.d:nth-child(3){animation-delay:.4s}

/* LangGraph node bar */
.node-bar{padding:5px 12px;background:var(--bg);border-bottom:1px solid var(--bd);display:flex;align-items:center;gap:3px;flex-shrink:0;overflow-x:auto}
.node-chip{display:flex;align-items:center;gap:3px;padding:2px 7px;border-radius:5px;font-size:11px;font-weight:700;border:1px solid transparent;font-family:'JetBrains Mono',monospace;white-space:nowrap;transition:var(--t)}
.node-chip.active{background:rgba(9,105,218,.1);border-color:rgba(9,105,218,.3);color:var(--acc)}
.node-chip.hitl-node{background:rgba(130,80,223,.06);border-color:rgba(130,80,223,.2);color:var(--pur)}
.node-chip.default{color:var(--tx3)}
.node-arr{font-size:11px;color:var(--bd2)}
.nd-pulse{width:5px;height:5px;border-radius:50%;background:var(--acc);animation:pulse 1s infinite;margin-left:2px}

@keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}
@keyframes bncx{0%,80%,100%{transform:translateY(0)}40%{transform:translateY(-5px)}}
@keyframes fadeUp{from{opacity:0;transform:translateY(5px)}to{opacity:1;transform:translateY(0)}}
@keyframes spin{to{transform:rotate(360deg)}}
` + CARE_CSS + NOTIF_CSS + POLISH_CSS + NAVY_CSS;

// ─── RICH TEXT renderer ───────────────────────────────────────────────────────
function RichText({ text }) {
  return <>{text.split("\n").map((line, i) => {
    if (line.startsWith("## ")) return <div key={i} style={{ fontWeight:700, color:"#8250df", fontSize:11, margin:"6px 0 3px" }}>{line.slice(3)}</div>;
    if (line.startsWith("# "))  return <div key={i} style={{ fontWeight:700, color:"#1f2328", fontSize:12, margin:"6px 0 3px" }}>{line.slice(2)}</div>;
    if (line.startsWith("- ")||line.startsWith("• ")) return <div key={i} style={{ paddingLeft:10, marginBottom:2, color:"#57606a" }}><span style={{ color:"#8250df", marginRight:5 }}>•</span>{line.slice(2)}</div>;
    if (line.startsWith("— Selma")) return <div key={i} style={{ marginTop:5, color:"#8250df", fontStyle:"italic", fontSize:11 }}>{line}</div>;
    if (line === "") return <div key={i} style={{ height:4 }}/>;
    return <div key={i} style={{ marginBottom:2 }}>{line}</div>;
  })}</>;
}

// ─── Badge helpers ────────────────────────────────────────────────────────────
function UBadge({ u }) { const m={ critical:["bc","Critical"], high:["bh","High"], moderate:["bm","Moderate"], low:["bl","Low"] }; const [c,l]=m[u]||["bs",u]; return <span className={`bdg ${c}`}>{l}</span>; }
function SBadge({ s }) { const m={ "in-room":["bir","In room"], waiting:["bh","Waiting"], scheduled:["bs","Scheduled"] }; const [c,l]=m[s]||["bs",s]; return <span className={`bdg ${c}`}>{l}</span>; }


const TOOL_LABELS = { get_patient_list:"Reviewing your patient list", get_patient_detail:"Reading the patient record", get_wound_assessments:"Reviewing wound assessments", get_billing_history:"Reviewing billing history", get_audit_trail:"Checking the audit trail", get_selma_checkin:"Reading the latest check-in", get_care_plan:"Reading the care plan", search_guidelines:"Searching clinical guidelines", search_clinical_kb:"Searching clinical reference", prioritize_patients:"Ranking patients by urgency", send_to_patient:"Preparing a message to the patient", escalate_to_ed:"Preparing an emergency escalation", vascular_referral:"Preparing a vascular referral", modify_care_plan:"Preparing a care plan update", request_labs:"Preparing a lab order" };
const toolLabel = n => TOOL_LABELS[n] || String(n || "").replace(/_/g, " ").replace(/^./, c => c.toUpperCase());
// HITL field definitions
const HITL_FIELDS = {
  send_to_patient:[{ id:"message", label:"Message to patient", type:"textarea" }],
  escalate_to_ed:[ { id:"reason", label:"Clinical reason", type:"textarea" }],
  vascular_referral:[{ id:"reason", label:"Referral reason", type:"textarea" }, { id:"urgency", label:"Urgency", type:"select", options:["urgent","emergent","routine"] }],
  modify_care_plan:[{ id:"change", label:"Care plan change", type:"textarea" }],
  request_labs:[{ id:"tests", label:"Tests to order (comma-separated)", type:"textarea" }, { id:"reason", label:"Reason", type:"textarea" }],
};

// ═══════════════════════════════════════════════════════════════════════════════
// WOUND ASSESSMENT MODAL — in-person or telehealth
// ═══════════════════════════════════════════════════════════════════════════════
function AssessmentModal({ patient, wound, defaultMethod, onSave, onCancel }) {
  const last = wound.assessments[wound.assessments.length-1];
  const [method, setMethod] = useState(defaultMethod || "In-person");
  const [length, setLength] = useState(last ? Math.sqrt(last.area||1).toFixed(1) : "");
  const [width, setWidth] = useState(last ? Math.sqrt(last.area||1).toFixed(1) : "");
  const [tissueType, setTissueType] = useState(last?.tissueType || TISSUE_TYPES[2]);
  const [exudateType, setExudateType] = useState(last?.exudateType || EXUDATE_TYPES[1]);
  const [exudateAmount, setExudateAmount] = useState(last?.exudateAmount || EXUDATE_AMOUNTS[2]);
  const [woundEdges, setWoundEdges] = useState(last?.woundEdges || WOUND_EDGES[0]);
  const [periwound, setPeriwound] = useState(last?.periwound || PERIWOUND_OPTIONS[0]);
  const [painScore, setPainScore] = useState(last?.painScore ?? "0");
  const [painDescriptor, setPainDescriptor] = useState(last?.painDescriptor || PAIN_DESCRIPTORS[0]);
  const [infectionSigns, setInfectionSigns] = useState(last?.infectionSigns || []);
  const [notes, setNotes] = useState("");
  const [procedures, setProcedures] = useState([]);

  const area = (parseFloat(length)||0) * (parseFloat(width)||0);
  const livePush = computePush({ area, exudateAmount, tissueType });
  const toggleSign = (s) => setInfectionSigns(v => v.includes(s) ? v.filter(x=>x!==s) : [...v, s]);

  const submit = () => onSave(wound.id, { method, area:Math.round(area*100)/100, tissueType, exudateType, exudateAmount, woundEdges, periwound, painScore:String(painScore), painDescriptor, infectionSigns, notes, procedures: method==="In-person" ? procedures : [] });

  return (
    <div className="modal-backdrop" onClick={e => { if (e.target===e.currentTarget) onCancel(); }}>
      <div className="modal-panel">
        <div className="modal-hdr">
          <div>
            <div className="modal-title">New Wound Assessment</div>
            <div className="modal-sub">{patient.name} · {wound.type} · {wound.location}</div>
          </div>
          <button className="modal-close" onClick={onCancel} aria-label="Close"><Ic n="close"/></button>
        </div>

        <div className="af-field">
          <div className="af-label">Assessment method</div>
          <div className="af-method-row">
            {ASSESSMENT_METHODS.map(m => (
              <div key={m} className={`af-method-btn ${method===m?"sel":""}`} onClick={() => setMethod(m)}>{m==="Telehealth"?<><Ic n="video"/>{" "}</>:<><Ic n="exam"/>{" "}</>}{m}</div>
            ))}
          </div>
        </div>

        <div className="af-row">
          <div className="af-field"><div className="af-label">Length (cm)</div><input type="number" step="0.1" min="0" value={length} onChange={e=>setLength(e.target.value)}/></div>
          <div className="af-field"><div className="af-label">Width (cm)</div><input type="number" step="0.1" min="0" value={width} onChange={e=>setWidth(e.target.value)}/></div>
        </div>

        <div className="af-row">
          <div className="af-field"><div className="af-label">Tissue type</div>
            <select value={tissueType} onChange={e=>setTissueType(e.target.value)}>{TISSUE_TYPES.map(t=><option key={t}>{t}</option>)}</select>
          </div>
          <div className="af-field"><div className="af-label">Wound edges</div>
            <select value={woundEdges} onChange={e=>setWoundEdges(e.target.value)}>{WOUND_EDGES.map(t=><option key={t}>{t}</option>)}</select>
          </div>
        </div>

        <div className="af-row">
          <div className="af-field"><div className="af-label">Exudate type</div>
            <select value={exudateType} onChange={e=>setExudateType(e.target.value)}>{EXUDATE_TYPES.map(t=><option key={t}>{t}</option>)}</select>
          </div>
          <div className="af-field"><div className="af-label">Exudate amount</div>
            <select value={exudateAmount} onChange={e=>setExudateAmount(e.target.value)}>{EXUDATE_AMOUNTS.map(t=><option key={t}>{t}</option>)}</select>
          </div>
        </div>

        <div className="af-row">
          <div className="af-field"><div className="af-label">Periwound skin</div>
            <select value={periwound} onChange={e=>setPeriwound(e.target.value)}>{PERIWOUND_OPTIONS.map(t=><option key={t}>{t}</option>)}</select>
          </div>
          <div className="af-field"><div className="af-label">Pain score (0–10) · descriptor</div>
            <div style={{ display:"flex", gap:6 }}>
              <input type="number" min="0" max="10" value={painScore} onChange={e=>setPainScore(e.target.value)} style={{ width:60 }}/>
              <select value={painDescriptor} onChange={e=>setPainDescriptor(e.target.value)}>{PAIN_DESCRIPTORS.map(t=><option key={t}>{t}</option>)}</select>
            </div>
          </div>
        </div>

        <div className="af-field">
          <div className="af-label">Signs of infection</div>
          <div className="af-chip-grid">
            {INFECTION_SIGN_OPTIONS.map(s => (
              <div key={s} className={`af-chip ${infectionSigns.includes(s)?"sel":""}`} onClick={() => toggleSign(s)}>{s}</div>
            ))}
          </div>
        </div>

        {method==="In-person" ? (
          <div className="af-field">
            <div className="af-label">Procedures performed today (only documented procedures are coded for CPT)</div>
            <div className="af-chip-grid">
              {PROCEDURE_OPTIONS.map(s => (
                <div key={s} className={`af-chip ${procedures.includes(s)?"sel":""}`} onClick={() => setProcedures(v => v.includes(s) ? v.filter(x=>x!==s) : [...v, s])}>{s}</div>
              ))}
            </div>
          </div>
        ) : (
          <div style={{ fontSize:11, color:"var(--tx3)", margin:"4px 0 8px" }}>Telehealth assessments can't document procedures (debridement, NPWT, compression) — those are billed only for in-person visits.</div>
        )}
        <div className="af-field">
          <div className="af-label">Notes</div>
          <textarea rows={2} placeholder="Additional clinical observations…" value={notes} onChange={e=>setNotes(e.target.value)}/>
        </div>

        <div className="af-push-preview">
          <div>
            <div style={{ fontSize:11, fontWeight:700, color:"var(--tx3)", textTransform:"uppercase", letterSpacing:".05em" }}>Computed PUSH score</div>
            <div style={{ fontSize:11, color:"var(--tx3)" }}>Area {area.toFixed(2)} cm² · PUSH Tool 3.0</div>
          </div>
          <div className="af-push-num" style={{ color: livePush>=15?"var(--red)":livePush>=10?"var(--org)":"var(--grn)" }}>{livePush}/17</div>
        </div>

        <div className="af-btns">
          <button className="af-save" onClick={submit}><Ic n="check"/> Save assessment</button>
          <button className="af-cancel" onClick={onCancel}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ADD WOUND MODAL
// ═══════════════════════════════════════════════════════════════════════════════
function AddWoundModal({ patientName, onSave, onCancel }) {
  const [type, setType] = useState(WOUND_TYPES[0]);
  const [location, setLocation] = useState("");

  return (
    <div className="modal-backdrop" onClick={e => { if (e.target===e.currentTarget) onCancel(); }}>
      <div className="modal-panel" style={{ maxWidth:440 }}>
        <div className="modal-hdr">
          <div>
            <div className="modal-title">Add New Wound</div>
            <div className="modal-sub">{patientName}</div>
          </div>
          <button className="modal-close" onClick={onCancel} aria-label="Close"><Ic n="close"/></button>
        </div>
        <div className="af-field"><div className="af-label">Wound type</div>
          <select value={type} onChange={e=>setType(e.target.value)}>{WOUND_TYPES.map(t=><option key={t}>{t}</option>)}</select>
        </div>
        <div className="af-field"><div className="af-label">Location</div>
          <input placeholder="e.g. Left heel, posterior" value={location} onChange={e=>setLocation(e.target.value)}/>
        </div>
        <div className="af-btns">
          <button className="af-save" disabled={!location.trim()} style={{ opacity:location.trim()?1:.5 }} onClick={() => location.trim() && onSave({ type, location:location.trim() })}><Ic n="check"/> Add wound</button>
          <button className="af-cancel" onClick={onCancel}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// DASHBOARD VIEW
// ═══════════════════════════════════════════════════════════════════════════════
function DashboardView({ patients, onOpenPatient, telehealthLog }) {
  const critHigh = patients.filter(p => p.urgency==="critical"||p.urgency==="high").length;
  const waiting = patients.filter(p => p.visitStatus==="waiting"||p.visitStatus==="in-room").length;
  const avgAdherence = Math.round(patients.reduce((s,p)=>s+p.adherence,0)/(patients.length||1));

  return (
    <div className="dash">
      <div className="dash-hdr">
        <div className="dash-title">Clinical Dashboard</div>
        <div className="dash-sub">{new Date().toLocaleDateString("en-US",{ weekday:"long", month:"long", day:"numeric" })} · {patients.length} patients scheduled</div>
      </div>

      <div className="stat-row">
        <div className="stat-card"><div className="stat-num">{patients.length}</div><div className="stat-lbl">Total patients</div></div>
        <div className="stat-card"><div className="stat-num" style={{ color:"var(--red)" }}>{critHigh}</div><div className="stat-lbl">Critical / high</div></div>
        <div className="stat-card"><div className="stat-num" style={{ color:"var(--acc)" }}>{waiting}</div><div className="stat-lbl">Waiting / in-room</div></div>
        <div className="stat-card"><div className="stat-num" style={{ color:avgAdherence>=70?"var(--grn)":avgAdherence>=40?"var(--yel)":"var(--red)" }}>{avgAdherence}%</div><div className="stat-lbl">Avg. adherence</div></div>
      </div>

      <div className="dash-section-lbl">Today's patients · sorted by urgency</div>
      {patients.length === 0 && <div className="empty-state fade-in"><div style={{ fontSize:28 }}><Ic n="inbox"/></div><b>No patients assigned to you yet</b><span className="measure">Ask your organization admin to assign patients to your account. You'll only see patients you're assigned to.</span></div>}
      <div className="dash-grid">
        {patients.map(p => (
          <div key={p.id} className="dcard" {...kb(() => onOpenPatient(p.id))}>
            <div className="dcard-top">
              <div className="dcard-name">{p.name}</div>
              <UBadge u={p.urgency}/>
            </div>
            <div className="dcard-meta">{p.age} · {p.gender} · {p.woundType.split(" ").slice(0,3).join(" ")}</div>
            <div style={{ display:"flex", gap:5, alignItems:"center", marginBottom:6 }}>
              <SBadge s={p.visitStatus}/>
              {p.visitStatus==="waiting"&&<span style={{ fontSize:11, color:"var(--yel)" }}><Ic n="timer"/>{p.waitMins}m</span>}
              {telehealthLog[p.id]?.length>0 && <span className="pill p-grn" style={{ fontSize:11 }}><Ic n="video"/> {telehealthLog[p.id].length}</span>}
              {p.ladderOpen>0 && <span className="pill p-org" style={{ fontSize:11 }} title="Treatment-ladder suggestions waiting for your decision"><Ic n="ladder"/> {p.ladderOpen}</span>}
            </div>
            {p.alerts[0] && <div className="dcard-alert"><Ic n="flag"/> {p.alerts[0].slice(0,50)}</div>}
            <div className="adh"><div className="adh-f" style={{ width:`${p.adherence}%`, background:p.adherence>=70?"var(--grn)":p.adherence>=40?"var(--yel)":"var(--red)" }}/></div>
            <div className="dcard-btn">Open chart →</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TELEHEALTH VIEW
// ═══════════════════════════════════════════════════════════════════════════════
function TelehealthView({ patient, sessionId, onEnd, onBack, onRecordAssessment }) {
  const [seconds, setSeconds] = useState(0);
  const [muted, setMuted] = useState(false);
  const [videoOff, setVideoOff] = useState(false);
  const [woundPick, setWoundPick] = useState(patient.wounds[0]?.id || "");
  const [callState, setCallState] = useState("idle");
  const [mediaErr, setMediaErr] = useState("");
  const [joined, setJoined] = useState(false);
  const [consent, setConsent] = useState(null);
  const [scribeCfg, setScribeCfg] = useState({ available:false, mock:false });
  const [scribeState, setScribeState] = useState("off");
  const [scribeDetail, setScribeDetail] = useState("");
  const [segments, setSegments] = useState([]);
  const [partials, setPartials] = useState({});
  const [ending, setEnding] = useState(false);
  const callRef = useRef(null), scribeRef = useRef(null), localRef = useRef(null), remoteRef = useRef(null), ready = useRef(Promise.resolve()), offered = useRef(false), capRef = useRef(null);

  useEffect(() => {
    const offer = () => { if (offered.current) return; offered.current = true; ready.current.then(() => callRef.current?.callRemote()).catch(() => { offered.current = false; }); };
    ready.current = (async () => {
      const cfg = await api.req("/api/telehealth/ice");
      setScribeCfg(cfg.scribe);
      const call = new VideoCall({
        role:"clinician", iceServers:cfg.iceServers,
        sendSignal:(kind, data) => api.req(`/api/telehealth/${sessionId}/signal`, { kind, data }),
        onRemoteStream:(s) => { if (remoteRef.current) { remoteRef.current.srcObject = s; remoteRef.current.play?.().catch(() => {}); } },
        onState:setCallState,
      });
      callRef.current = call;
      try { const ls = await call.startMedia(); if (localRef.current) localRef.current.srcObject = ls; }
      catch (e) { setMediaErr(`Camera/microphone unavailable: ${e?.message || e}`); }
      const { session } = await api.req(`/api/telehealth/${sessionId}`);
      if (session.patientJoined) { setJoined(true); setConsent(session.consentGiven === true); offer(); }
    })();
    const u1 = bridge.subscribe(CH.TELEHEALTH_SIGNAL, ev => { if (ev.sessionId === sessionId && ev.from === "patient") callRef.current?.handleSignal(ev.kind, ev.data); });
    const u2 = bridge.subscribe(CH.SELMA_TELEHEALTH_JOIN, ev => { if (ev.sessionId === sessionId) { setJoined(true); setConsent(ev.consent === true); offer(); } });
    return () => { u1(); u2(); callRef.current?.close(); };
  }, [sessionId]);

  useEffect(() => {
    if (!joined) return;
    const t = setInterval(() => setSeconds(s => s+1), 1000);
    return () => clearInterval(t);
  }, [joined]);

  // Start the AI scribe once the patient has joined, consented, and the call is connected.
  useEffect(() => {
    if (!(joined && consent === true && callState === "connected" && scribeCfg.available) || scribeRef.current) return;
    const call = callRef.current;
    const cap = new ScribeCapture({
      apiBase: API_URL, local: call.localStream, remote: call.remoteStream,
      getToken: () => api.req(`/api/telehealth/${sessionId}/scribe`, {}),
      onSegment: (seg) => {
        if (seg.partial) setPartials(p => ({ ...p, [seg.speaker]: seg.text }));
        else { setSegments(s => [...s.filter(x => x.id !== seg.id), seg]); setPartials(p => ({ ...p, [seg.speaker]: "" })); }
      },
      onStatus: (s, d) => { setScribeState(s); setScribeDetail(d || ""); },
    });
    scribeRef.current = cap;
    cap.start().catch(e => { setScribeState("error"); setScribeDetail(e?.message || "could not start"); });
  }, [joined, consent, callState, scribeCfg.available]);

  const toggleMute = () => { setMuted(m => { callRef.current?.setMuted(!m); return !m; }); };
  const toggleVideo = () => { setVideoOff(v => { callRef.current?.setCameraOff(!v); return !v; }); };
  const end = async () => {
    if (ending) return;
    setEnding(true);
    try { await scribeRef.current?.stop(); } catch {}
    try { await api.req(`/api/telehealth/${sessionId}/signal`, { kind:"bye" }); } catch {}
    callRef.current?.close();
    onEnd(seconds);
  };

  const mins = Math.floor(seconds/60), secs = seconds%60;
  const initials = patient.name.split(" ").map(n=>n[0]).join("");
  const uc = urgColor(patient.urgency);
  const connected = callState === "connected";
  const scribeLabel = !scribeCfg.available ? "AI scribe not enabled on this server"
    : !joined ? "Waiting for patient to join…"
    : consent === false ? "Patient declined recording — not transcribing"
    : scribeState === "live" ? "AI scribe live" : scribeState === "connecting" ? "Starting AI scribe…" : scribeState === "reconnecting" ? "Reconnecting scribe…"
    : scribeState === "finishing" ? "Finishing transcript…" : scribeState === "error" ? `Scribe error${scribeDetail ? `: ${scribeDetail}` : ""}` : "AI scribe waiting for call to connect";
  const shown = segments.slice(-8);

  return (
    <div className="th">
      <div className="th-topbar">
        <div className="th-status"><div className="th-rec-dot"/>Live telehealth visit · {patient.name} · <span style={{ fontWeight:400, color:"var(--tx2)" }}>{!joined ? "waiting for patient" : connected ? "connected" : callState === "ended" ? "patient left the call" : callState}</span></div>
        <div className="th-timer">{String(mins).padStart(2,"0")}:{String(secs).padStart(2,"0")}</div>
      </div>
      {mediaErr && <div className="th-notes" style={{ color:"var(--red)", fontSize:11 }}>{mediaErr}</div>}

      <div className="th-tiles">
        <div className="th-tile">
          <video ref={remoteRef} className="th-video" autoPlay playsInline style={{ display: connected ? "block" : "none" }}/>
          {!connected && <div className="th-avatar" style={{ background:uc }}>{initials}</div>}
          <div className="th-tile-label">{patient.name} · Patient</div>
          <video ref={localRef} className="th-selfvid" autoPlay playsInline muted/>
        </div>
        <div className="th-tile th-caps">
          <div className="th-caps-hdr">
            <span className={`pill ${scribeState==="live" ? "p-grn" : scribeState==="error" ? "p-red" : "p-blu"}`}>{scribeLabel}</span>
            {scribeCfg.mock && <span className="pill p-red" title="Dev/test provider">SIMULATED transcript</span>}
          </div>
          <div className="th-caps-body">
            {shown.length === 0 && !partials.clinician && !partials.patient && <div style={{ color:"#8b949e", fontSize:11 }}>Live captions appear here once the AI scribe is running. Only the clinician sees them.</div>}
            {shown.map(s => <div key={s.id} className="th-cap"><b className={s.speaker}>{s.speaker === "clinician" ? "You" : "Patient"}</b> {s.text}</div>)}
            {["clinician","patient"].map(sp => partials[sp] ? <div key={sp} className="th-cap partial"><b className={sp}>{sp === "clinician" ? "You" : "Patient"}</b> {partials[sp]}…</div> : null)}
          </div>
        </div>
      </div>

      <div className="th-controls">
        <div className={`th-ctrl-btn ${muted?"off":""}`} {...kb(toggleMute)} title="Toggle mute" aria-label="Toggle mute" aria-pressed={muted}>{muted?<Ic n="mic-off"/>:<Ic n="mic"/>}</div>
        <div className={`th-ctrl-btn ${videoOff?"off":""}`} {...kb(toggleVideo)} title="Toggle camera" aria-label="Toggle camera" aria-pressed={videoOff}>{videoOff?<Ic n="video-off"/>:<Ic n="video"/>}</div>
        <div className="th-ctrl-btn end" {...kb(end)} title="End visit" aria-label="End visit" style={{ opacity: ending ? .5 : 1 }}><Ic n="end-call"/></div>
      </div>

      {patient.wounds.length>0 && (
        <div className="th-notes" style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:10, flexWrap:"wrap" }}>
          <div style={{ display:"flex", alignItems:"center", gap:8 }}>
            <span style={{ fontSize:11, fontWeight:700, color:"var(--tx3)", textTransform:"uppercase", letterSpacing:".05em" }}>Wound</span>
            {patient.wounds.length>1 ? (
              <select value={woundPick} onChange={e=>setWoundPick(e.target.value)} style={{ background:"var(--s1)", border:"1px solid var(--bd2)", borderRadius:6, padding:"5px 8px", fontSize:11, color:"var(--tx)" }}>
                {patient.wounds.map(w => <option key={w.id} value={w.id}>{w.type} · {w.location}</option>)}
              </select>
            ) : (
              <span style={{ fontSize:11, color:"var(--tx)" }}>{patient.wounds[0].type} · {patient.wounds[0].location}</span>
            )}
          </div>
          <button className="th-assess-btn" onClick={() => onRecordAssessment(woundPick)}><Ic n="wound"/> Record wound assessment</button>
        </div>
      )}

      <div className="th-notes">
        <div className="ct"><Ic n="note"/> Visit context</div>
        <div style={{ fontSize:11, color:"var(--tx2)", lineHeight:1.6 }}>
          {patient.mrn} · {patient.woundType} · Last PUSH {patient.lastAssessment.push}/17 · Adherence {patient.adherence}%
          {patient.allergies.length>0 && <span style={{ color:"var(--red)" }}> · <Ic n="warn"/> {patient.allergies.join(", ")}</span>}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// SCRIBE REVIEW — the clinician reviews/edits the transcript BEFORE any codes are generated from it
// ═══════════════════════════════════════════════════════════════════════════════
function ScribeReview({ patient, sessionId, onConfirmed, onDiscarded, onBack }) {
  const [session, setSession] = useState(null);
  const [edits, setEdits] = useState({});
  const [woundId, setWoundId] = useState(patient.wounds[0]?.id || "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    let stop = false, timer;
    const load = async () => {
      try {
        const { session: s } = await api.req(`/api/telehealth/${sessionId}`);
        if (stop) return; setSession(s);
        if (["processing","streaming"].includes(s.scribe.status) && s.status === "review") timer = setTimeout(load, 3000);
      } catch (e) { if (!stop) setErr(e?.message || "Could not load transcript"); }
    };
    load();
    return () => { stop = true; clearTimeout(timer); };
  }, [sessionId]);

  if (!session) return <div className="dash"><div style={{ padding:24, fontSize:12, color:"var(--tx3)" }}>{err || "Loading transcript…"}</div></div>;
  const turns = session.transcript || [];
  const processing = ["processing","streaming"].includes(session.scribe.status);
  const mock = session.scribe.provider === "mock";
  const changed = Object.entries(edits).filter(([id, text]) => text !== turns.find(t => t.id === id)?.text).map(([id, text]) => ({ id, text }));

  const confirm = async () => {
    setBusy(true); setErr("");
    try { const r = await api.req(`/api/telehealth/${sessionId}/confirm`, { edits: changed, woundId: woundId || undefined }); onConfirmed(r); }
    catch (e) { setErr(e?.message || "Failed"); setBusy(false); }
  };
  const discard = async () => {
    if (!window.confirm("Discard this transcript? It will be deleted and not used for coding.")) return;
    setBusy(true);
    try { const r = await api.req(`/api/telehealth/${sessionId}/discard`, {}); onDiscarded(r); } catch (e) { setErr(e?.message || "Failed"); setBusy(false); }
  };

  return (
    <div className="dash">
      <div className="dash-hdr">
        <span onClick={onBack} style={{ fontSize:11, color:"var(--acc)", cursor:"pointer", fontWeight:600 }}>← {patient.name}</span>
        <div className="dash-title" style={{ marginTop:4 }}><Ic n="note"/> Review visit transcript</div>
        <div className="dash-sub">{patient.name} · {Math.floor((session.durationSec||0)/60)}m visit · edit anything the scribe got wrong, then generate coding suggestions. Nothing is billed without your approval.</div>
      </div>
      {mock && <div className="th-notes" style={{ color:"var(--red)", fontSize:11, marginBottom:10 }}><Ic n="warn"/> This transcript is SIMULATED (dev/test provider) — it was not produced from the audio.</div>}
      {processing && <div className="th-notes" style={{ fontSize:11, marginBottom:10 }}><Ic n="waiting"/> The scribe is still finishing the clinical note… you can already review the transcript below.</div>}
      {session.scribe.status === "failed" && <div className="th-notes" style={{ color:"var(--red)", fontSize:11, marginBottom:10 }}>The scribe reported a problem; the transcript may be incomplete.</div>}
      {session.status !== "review" ? (
        <div className="th-notes" style={{ fontSize:12 }}>This transcript has already been {session.status === "coded" ? "coded" : "handled"}.</div>
      ) : <>
        <div className="rv-turns">
          {turns.length === 0 && <div style={{ fontSize:12, color:"var(--tx3)", padding:12 }}>No transcript was captured.</div>}
          {turns.map(t => (
            <div key={t.id} className="rv-turn">
              <span className={`rv-who ${t.speaker}`}>{t.speaker === "clinician" ? "Clinician" : "Patient"}</span>
              <textarea rows={Math.min(5, Math.max(1, Math.ceil((edits[t.id] ?? t.text).length / 90)))} value={edits[t.id] ?? t.text} onChange={e => setEdits(x => ({ ...x, [t.id]: e.target.value }))}/>
              {edits[t.id] !== undefined && edits[t.id] !== t.text && <span className="pill p-pur" style={{ fontSize:11 }}>edited</span>}
            </div>
          ))}
        </div>
        {session.note?.sections?.length > 0 && (
          <div className="th-notes" style={{ marginTop:12 }}>
            <div className="ct"><Ic n="receipt"/> AI-generated clinical note (reference only — not used for coding)</div>
            {session.note.sections.map((s, i) => (
              <div key={i} style={{ marginTop:6 }}>
                <div style={{ fontSize:11, fontWeight:700, color:"var(--tx3)", textTransform:"uppercase" }}>{s.name}</div>
                {s.items.map((it, j) => <div key={j} style={{ fontSize:11, color:"var(--tx2)", margin:"2px 0" }}>• {it.text}</div>)}
              </div>
            ))}
          </div>
        )}
        {patient.wounds.length > 1 && (
          <div className="th-notes" style={{ marginTop:12, display:"flex", gap:8, alignItems:"center" }}>
            <span style={{ fontSize:11, fontWeight:700, color:"var(--tx3)", textTransform:"uppercase" }}>Code against wound</span>
            <select value={woundId} onChange={e => setWoundId(e.target.value)} style={{ border:"1px solid var(--bd2)", borderRadius:6, padding:"5px 8px", fontSize:11 }}>{patient.wounds.map(w => <option key={w.id} value={w.id}>{w.type} · {w.location}</option>)}</select>
          </div>
        )}
        {err && <div style={{ color:"var(--red)", fontSize:11, margin:"8px 0" }}>{err}</div>}
        <div style={{ display:"flex", gap:8, marginTop:12 }}>
          <button className="af-save" disabled={busy || processing || turns.length === 0} onClick={confirm} style={{ flex:1, opacity: busy || processing || !turns.length ? .5 : 1 }}><Ic n="check"/> {changed.length ? `Save ${changed.length} edit${changed.length>1?"s":""} & ` : ""}generate coding suggestions</button>
          <button className="hitl-reject" disabled={busy} onClick={discard} style={{ flex:"0 0 auto", padding:"0 16px" }}>Discard transcript</button>
        </div>
      </>}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// BILLING & AUDIT VIEW
// ═══════════════════════════════════════════════════════════════════════════════
function BillingAuditView({ patient, onApprove, onReject, onBack }) {
  const [tab, setTab] = useState("billing"); // "billing" | "audit"
  const [expanded, setExpanded] = useState({});
  const [checked, setChecked] = useState({});
  const [rejecting, setRejecting] = useState(null);
  const [rejectReason, setRejectReason] = useState("");

  const toggleExpand = (id) => setExpanded(e => ({ ...e, [id]: !e[id] }));
  const isChecked = (visitId, code) => checked[visitId]?.[code] !== false; // default checked
  const toggleCode = (visitId, code) => setChecked(c => ({ ...c, [visitId]: { ...c[visitId], [code]: !isChecked(visitId, code) } }));

  const visits = [...patient.billing].reverse();
  const pending = visits.filter(v => v.status==="pending").length;

  return (
    <div className="dash">
      <div className="dash-hdr" style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", flexWrap:"wrap", gap:8 }}>
        <div>
          <span onClick={onBack} style={{ fontSize:11, color:"var(--acc)", cursor:"pointer", fontWeight:600 }}>← {patient.name}</span>
          <div className="dash-title" style={{ marginTop:4 }}><Ic n="billing"/> Billing &amp; Audit</div>
          <div className="dash-sub">{patient.name} · {patient.mrn} · ICD-10 / CPT suggestions · must be validated by a certified coder before submission</div>
        </div>
        {pending>0 && <span className="pill p-red" style={{ animation:"hpulse .8s infinite" }}><Ic n="pending"/> {pending} pending review</span>}
      </div>

      <div className="bill-tabs">
        <div className={`bill-tab ${tab==="billing"?"sel":""}`} onClick={() => setTab("billing")}>Billing queue</div>
        <div className={`bill-tab ${tab==="audit"?"sel":""}`} onClick={() => setTab("audit")}>Audit trail</div>
      </div>

      {tab==="billing" && (
        visits.length===0 ? (
          <div style={{ textAlign:"center", padding:"40px 16px", color:"var(--tx3)" }}>
            <div style={{ fontSize:28, marginBottom:8 }}><Ic n="billing"/></div>
            <div style={{ fontSize:12 }}>No billing activity yet. Record a wound assessment or complete a telehealth visit to generate coded recommendations.</div>
          </div>
        ) : visits.map(v => {
          const codeList = v.codes.map(c => c.code);
          const selectedCodes = v.status==="approved" ? v.approvedCodes : v.codes.filter(c => isChecked(v.id, c.code));
          return (
            <div key={v.id} className="bill-card">
              <div className="bill-card-hdr">
                <div>
                  <div className="bill-card-title">{v.woundType} <span style={{ fontWeight:400, color:"var(--tx2)" }}>· {v.date} · {v.method}</span></div>
                  <div style={{ fontSize:11, color:"var(--tx3)" }}>{v.codes.length} recommended code{v.codes.length!==1?"s":""}</div>
                </div>
                <span className={`bill-status ${v.status}`}>
                  {v.status==="pending" ? <><Ic n="pending"/> Pending review</> : v.status==="approved" ? <><Ic n="check"/> Approved</> : <><Ic n="close"/> Rejected</>}
                </span>
              </div>

              <div className="bill-toggle" onClick={() => toggleExpand(v.id)}>{expanded[v.id] ? "▾" : "▸"} {v.scribe ? "Visit transcript (AI scribe" + (v.scribe.edited ? ", clinician-edited" : "") + ") " : "Visit note (generated from the structured exam) "}&amp; extracted entities</div>
              {expanded[v.id] && (
                <div className="bill-transcript">
                  <div className="bill-transcript-text">{v.transcript}</div>
                  <div className="bill-entities">
                    {v.entities.map((e,i) => (
                      <span key={i} className="bill-entity-chip" title={`${e.type} · ${(e.confidence*100).toFixed(0)}% confidence`}>{e.text} <b>{(e.confidence*100).toFixed(0)}%</b></span>
                    ))}
                  </div>
                </div>
              )}

              <div className="bill-codes">
                {v.codes.map(c => {
                  const on = v.status==="approved" ? v.approvedCodes.some(a=>a.code===c.code) : isChecked(v.id, c.code);
                  return (
                    <div key={c.code} className="bill-code-row">
                      {v.status==="pending" && <input type="checkbox" checked={isChecked(v.id,c.code)} onChange={() => toggleCode(v.id, c.code)}/>}
                      <span className={`bill-code-type ${c.type==="ICD-10"?"icd":"cpt"}`}>{c.type}</span>
                      <span className="bill-code-num">{c.code}</span>
                      <span className="bill-code-desc">{c.desc}</span>
                      <span className="bill-code-conf" style={{ color: c.confidence>=0.9?"var(--grn)":c.confidence>=0.8?"var(--yel)":"var(--org)" }}>{(c.confidence*100).toFixed(0)}%</span>
                      <div className="bill-code-reason">{c.reasoning}</div>
                      {c.evidence?.length > 0 && <div className="bill-ev"><b>Evidence from the visit:</b>{c.evidence.map((e,i) => <span key={i} className="bill-q">{e.speaker === "clinician" ? "Clinician" : "Patient"}: “{e.quote}”</span>)}</div>}
                    </div>
                  );
                })}
              </div>

              {v.status==="pending" && (
                rejecting===v.id ? (
                  <div style={{ marginTop:8 }}>
                    <textarea className="hitl-note" rows={2} placeholder="Reason for rejecting these codes (for audit log)…" value={rejectReason} onChange={e=>setRejectReason(e.target.value)}/>
                    <div className="af-btns" style={{ marginTop:6 }}>
                      <button className="hitl-reject" style={{ flex:1 }} onClick={() => { onReject(v.id, rejectReason); setRejecting(null); setRejectReason(""); }}>Confirm rejection</button>
                      <button className="af-cancel" onClick={() => setRejecting(null)}>Cancel</button>
                    </div>
                  </div>
                ) : (
                  <div className="af-btns" style={{ marginTop:8 }}>
                    <button className="af-save" onClick={() => onApprove(v.id, selectedCodes.map(c => c.code))}><Ic n="check"/> Approve {selectedCodes.length} code{selectedCodes.length!==1?"s":""} for submission</button>
                    <button className="hitl-reject" style={{ flex:1 }} onClick={() => setRejecting(v.id)}><Ic n="close"/> Reject</button>
                  </div>
                )
              )}
              {v.status!=="pending" && (
                <div style={{ fontSize:11, color:"var(--tx3)", marginTop:6 }}>Reviewed by {v.reviewedBy} · {new Date(v.reviewedAt).toLocaleString()}</div>
              )}
            </div>
          );
        })
      )}

      {tab==="audit" && (
        <div className="audit-log">
          {[...patient.auditTrail].reverse().map(a => (
            <div key={a.id} className="audit-log-row">
              <div className="audit-log-main">
                <div className="audit-log-event">{a.event}</div>
                <div className="audit-log-detail">{a.detail}</div>
              </div>
              <div className="audit-log-meta">
                <div>{a.user}</div>
                <div>{new Date(a.ts).toLocaleString()}</div>
                <div className="audit-hash">#{a.hash}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
// ═══════════════════════════════════════════════════════════════════════════════
// LOGIN + ROOT
// ═══════════════════════════════════════════════════════════════════════════════
function LoginScreen({ onLoggedIn }) {
  const demo = import.meta.env.VITE_DEMO_MODE === "true";
  const [email, setEmail] = useState(demo ? "clinician@demo.test" : "");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault(); setBusy(true); setErr("");
    try { onLoggedIn(await login(email.trim(), password)); }
    catch (ex) { setErr(ex?.message || "Sign-in failed"); }
    finally { setBusy(false); }
  };
  return (
    <>
      <style>{css}</style>
      <div style={{ minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center", background:"linear-gradient(160deg,var(--navy) 0%,var(--navy-2) 100%)" }}>
        <form onSubmit={submit} className="hitl-card" style={{ width:340, maxWidth:"calc(100vw - 32px)", padding:22, background:"var(--s1)", border:0, boxShadow:"0 16px 48px rgba(0,0,0,.3)" }}>
          <img src="/unwound-logo.png" alt="unwound.ai" width="150" height="26" style={{ height:26, width:"auto", display:"block", marginBottom:10 }}/>
          <div style={{ fontSize:16, fontWeight:700, marginBottom:2 }}>Selma</div>
          <div style={{ fontSize:11, color:"var(--tx2)", marginBottom:16 }}>Clinician sign-in</div>
          <div className="af-field"><div className="af-label">Email</div><input type="email" autoComplete="username" required value={email} onChange={e=>setEmail(e.target.value)}/></div>
          <div className="af-field"><div className="af-label">Password</div><input type="password" autoComplete="current-password" required value={password} onChange={e=>setPassword(e.target.value)}/></div>
          {err && <div style={{ color:"var(--red)", fontSize:11, margin:"6px 0" }}>{err}</div>}
          <button className="af-save" type="submit" disabled={busy} style={{ width:"100%", marginTop:8 }}>{busy ? "Signing in…" : "Sign in"}</button>
          {demo && <div style={{ fontSize:11, color:"var(--tx3)", marginTop:10 }}>Demo mode — password is the server's DEMO_PASSWORD. Try: clinician@demo.test (all 4 patients), clinician2@demo.test (2 patients), clinician.b@demo.test (other org), orgadmin@demo.test, orgadmin.b@demo.test, admin@demo.test (platform admin). Demo data only — never enter real patient information.</div>}
        </form>
      </div>
    </>
  );
}

export default function Root() {
  const [user, setUser] = useState(null);
  const [checking, setChecking] = useState(!!session.get());
  useEffect(() => {
    setOnUnauthorized(() => { disablePush(null); setUser(null); });
    if (!session.get()) return;
    api.req("/api/auth/me").then(r => { if (r.user.role !== "patient") setUser(r.user); else session.clear(); }).catch(() => {}).finally(() => setChecking(false));
  }, []);
  if (checking) return null;
  if (!user) return <LoginScreen onLoggedIn={setUser}/>;
  const logout = async () => { await disablePush(api); clearImageCache(); session.clear(); setUser(null); };
  // Admins (org + platform) get a console with no clinical views; only clinicians reach the patient UI.
  if (user.role === "org_admin" || user.role === "super_admin") return <AdminConsole user={user} css={css} onLogout={logout}/>;
  return <App user={user} onLogout={logout}/>;
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN APP
// ═══════════════════════════════════════════════════════════════════════════════
function App({ user, onLogout }) {
  const [augiOpen, setSelmaOpen] = useState(false);       // <1024px: Selma is a slide-over drawer
  const [view, setView] = useState("dashboard"); // "dashboard" | "patient" | "telehealth" | "billing" | "review"
  const [teleSession, setTeleSession] = useState(null);   // { sessionId } for the live call
  const [teleSessions, setTeleSessions] = useState([]);    // recent sessions for the open patient (review banner)
  const [reviewId, setReviewId] = useState(null);
  const [selId, setSelId] = useState(null);
  const [patients, setPatients] = useState([]);
  const [loadErr, setLoadErr] = useState("");
  const [live, setLive] = useState(false);
  const [telehealthLog, setTelehealthLog] = useState({}); // patientId -> [{duration, endedAt}]
  const [assessmentTarget, setAssessmentTarget] = useState(null); // { woundId, method } | null
  const [addWoundOpen, setAddWoundOpen] = useState(false);
  const [input, setInput] = useState("");
  const [isRunning, setIsRunning] = useState(false);
  const [evLog, setEvLog] = useState([]);
  const [activeNode, setActiveNode] = useState(null);
  const [activeTools, setActiveTools] = useState([]);
  const [streamMap, setStreamMap] = useState({});
  const [hitlQueue, setHitlQueue] = useState([]);
  const [hitlHistory, setHitlHistory] = useState([]);
  const [timeline, setTimeline] = useState([]);
  const agentRef = useRef(new AugiClient());
  const streamRef = useRef({});
  const endRef = useRef(null);
  const initialized = useRef(false);
  const autoRef = useRef({});
  const selRef = useRef(null);
  const viewRef = useRef("dashboard");
  const hitlRef = useRef([]);
  useEffect(() => { selRef.current = selId; }, [selId]);
  useEffect(() => { viewRef.current = view; }, [view]);
  useEffect(() => { hitlRef.current = hitlQueue; }, [hitlQueue]);

  const patient = patients.find(p => p.id === selId);
  const urgRank = { critical:0, high:1, moderate:2, low:3 };
  const sorted = [...patients].sort((a,b) => urgRank[a.urgency]-urgRank[b.urgency]);

  function addEntry(entry) { setTimeline(t => [...t, { id:nid(), time:nowStr(), ...entry }]); }

  // ── Data loading ──
  const loadList = useCallback(async () => {
    try {
      const { patients: list } = await api.req("/api/patients");
      setLoadErr("");
      // Keep already-loaded detail (messages/audit/full billing) for the open patient until its refetch lands.
      setPatients(prev => list.map(n => { const o = prev.find(p => p.id === n.id); return o?.detailLoaded && n.id === selRef.current ? { ...n, billing:o.billing, messages:o.messages, auditTrail:o.auditTrail, wounds:o.wounds, detailLoaded:true } : n; }));
    } catch (e) { setLoadErr(e?.message || "Could not load patients"); }
  }, []);
  const loadSessions = useCallback(async (id) => {
    try { const r = await api.req(`/api/patients/${id}/telehealth/sessions`); setTeleSessions(r.sessions); } catch {}
  }, []);
  const loadDetail = useCallback(async (id) => {
    try {
      const { patient: full } = await api.req(`/api/patients/${id}`);
      setPatients(prev => prev.map(p => p.id === id ? full : p));
      loadSessions(id);
    } catch (e) { addEntry({ kind:"augi-error", text:`Could not load patient: ${e?.message}`, ts:Date.now() }); }
  }, []);
  const refreshTimer = useRef(null);
  const scheduleRefresh = useCallback((patientId) => {
    clearTimeout(refreshTimer.current);
    refreshTimer.current = setTimeout(() => { loadList(); if (patientId && patientId === selRef.current) loadDetail(patientId); }, 150);
  }, [loadList, loadDetail]);

  useEffect(() => {
    loadList();
    // Restore approvals that were still pending when this page was last open (they live in Postgres).
    api.req("/api/augi/pending").then(({ pending }) => {
      setHitlQueue(pending.map(p => ({ interruptId:p.interruptId, ...p.payload, patientId:p.patientId, ts:p.ts, note:"", fieldValues:fieldValuesFor(p.payload) })));
    }).catch(() => {});
    const stop = api.openEvents(e => { bridge.dispatch(e); }, setLive);
    const unsub = bridge.subscribe(CH.STORE_UPDATED, ev => scheduleRefresh(ev.patientId));
    const poll = setInterval(loadList, 60000); // safety net if the stream is blocked by a proxy
    return () => { stop(); unsub(); clearInterval(poll); };
  }, []);

  function fieldValuesFor(payload) {
    return (HITL_FIELDS[payload.toolName] || []).reduce((acc, f) => {
      const v = payload.input?.[f.id];
      acc[f.id] = Array.isArray(v) ? v.join(", ") : (v ?? "");
      return acc;
    }, {});
  }

  useEffect(() => { endRef.current?.scrollIntoView({ behavior:"smooth" }); }, [timeline, isRunning]);

  // ── AG-UI event handler → feeds unified timeline ──
  const handleEvent = useCallback((event) => {
    setEvLog(e => [...e.slice(-20), event]);
    switch (event.type) {
      case EV.RUN_STARTED:
        setIsRunning(true); setActiveNode("agent_node"); setActiveTools([]);
        addEntry({ kind:"augi-run-start", ts: event.ts });
        break;
      case EV.RUN_FINISHED:
        setIsRunning(false); setActiveNode(null); setActiveTools([]);
        break;
      case EV.RUN_ERROR:
        setIsRunning(false); setActiveNode(null);
        addEntry({ kind:"augi-error", text: event.message, ts: event.ts });
        break;
      case EV.TEXT_START:
        streamRef.current[event.messageId] = "";
        setStreamMap(s => ({ ...s, [event.messageId]: "" }));
        addEntry({ kind:"augi-stream", msgId: event.messageId, ts: event.ts });
        break;
      case EV.TEXT_CONTENT:
        streamRef.current[event.messageId] = (streamRef.current[event.messageId]||"") + event.delta;
        setStreamMap(s => ({ ...s, [event.messageId]: streamRef.current[event.messageId] }));
        setTimeline(t => t.map(e => e.msgId === event.messageId ? { ...e, streaming: streamRef.current[event.messageId] } : e));
        break;
      case EV.TEXT_END: {
        const full = streamRef.current[event.messageId] || "";
        delete streamRef.current[event.messageId];
        setStreamMap(s => { const n={...s}; delete n[event.messageId]; return n; });
        setTimeline(t => t.map(e => e.msgId === event.messageId ? { ...e, kind:"augi-text", text:full, streaming:null } : e));
        break;
      }
      case EV.TOOL_START:
        setActiveNode("tool_node");
        setActiveTools(t => [...t, { id:event.toolCallId, name:event.toolName, status:"running" }]);
        addEntry({ kind:"tool-call", toolName:event.toolName, callId:event.toolCallId, ts:event.ts });
        break;
      case EV.TOOL_END:
        setActiveTools(t => t.map(x => x.id===event.toolCallId ? { ...x, status:"done" } : x));
        setTimeline(t => t.map(e => e.callId===event.toolCallId ? { ...e, result:event.result, done:true } : e));
        break;
      case EV.HITL_REQUIRED: {
        const intercession = { interruptId:event.interruptId, ...event.payload, patientId:event.payload.input?.patient_id ?? null, fieldValues:fieldValuesFor(event.payload), ts:event.ts, note:"" };
        setHitlQueue(q => q.some(x => x.interruptId===event.interruptId) ? q : [...q, intercession]);
        setActiveNode("hitl_node");
        addEntry({ kind:"hitl-required", interruptId:event.interruptId, intercession, ts:event.ts });
        break;
      }
      case EV.HITL_RESOLVED:
        setActiveNode("agent_node");
        setHitlHistory(h => [...h, { ...event.decision }]);
        setTimeline(t => t.map(e => e.interruptId===event.interruptId ? { ...e, resolved:true, approved:true, decision:event.decision } : e));
        break;
      case EV.HITL_REJECTED:
        setActiveNode("agent_node");
        setHitlHistory(h => [...h, { approved:false, reason:event.reason, decidedAt:Date.now() }]);
        setTimeline(t => t.map(e => e.interruptId===event.interruptId ? { ...e, resolved:true, approved:false } : e));
        break;
    }
  }, []);

  // Patient-originated events (via the server's role-filtered stream) → timeline for the open patient
  useEffect(() => {
    const on = (kind, map) => ev => { if (ev.patientId !== selId) return; addEntry({ kind, ts:ev._ts, ...map(ev) }); };
    const u = [
      bridge.subscribe(CH.SELMA_CHECKIN, on("bridge-checkin", ev => ({ data:ev.data }))),
      bridge.subscribe(CH.SELMA_MESSAGE, on("bridge-message", ev => ({ text:ev.text, image:ev.image }))),
      bridge.subscribe(CH.SELMA_STEP_DONE, on("bridge-step", ev => ({ step:ev.step }))),
      bridge.subscribe(CH.SELMA_ALERT, on("bridge-alert", ev => ({ alert:ev.alert, severity:ev.severity }))),
      bridge.subscribe(CH.SELMA_TELEHEALTH_JOIN, on("bridge-telehealth-join", () => ({}))),
    ];
    return () => u.forEach(f => f());
  }, [selId]);

  // ── Send to Selma ──
  const send = useCallback(async (text, forPatient) => {
    if (isRunning || !text.trim()) return;
    addEntry({ kind:"user", text });
    setInput("");
    await agentRef.current.run(text, handleEvent, forPatient ?? selRef.current);
  }, [isRunning, handleEvent]);

  // ── HITL helpers ──
  const updateField = (interruptId, fieldId, value) => {
    setHitlQueue(q => q.map(x => x.interruptId===interruptId ? { ...x, fieldValues:{ ...x.fieldValues, [fieldId]:value } } : x));
    setTimeline(t => t.map(e => e.interruptId===interruptId ? { ...e, intercession:{ ...e.intercession, fieldValues:{ ...e.intercession.fieldValues, [fieldId]:value } } } : e));
  };
  const setNote = (interruptId, note) => {
    setHitlQueue(q => q.map(x => x.interruptId===interruptId ? { ...x, note } : x));
    setTimeline(t => t.map(e => e.interruptId===interruptId ? { ...e, intercession:{ ...e.intercession, note } } : e));
  };
  // The server executes the action (message delivery, care plan change, order…) and resumes the agent.
  const approve = (interruptId) => {
    const item = hitlQueue.find(x => x.interruptId===interruptId);
    if (!item) return;
    setHitlQueue(q => q.filter(x => x.interruptId!==interruptId));
    agentRef.current.decide({ interruptId, approved:true, finalValues:item.fieldValues, note:item.note }, handleEvent);
  };
  const reject = (interruptId) => {
    const item = hitlQueue.find(x => x.interruptId===interruptId);
    if (!item) return;
    setHitlQueue(q => q.filter(x => x.interruptId!==interruptId));
    agentRef.current.decide({ interruptId, approved:false, note:item.note || "Rejected by clinician" }, handleEvent);
  };

  // ── Auto-brief when a patient subpage is opened ──
  useEffect(() => {
    if (!patient || view!=="patient" || autoRef.current[selId] || isRunning) return;
    autoRef.current[selId] = true;
    setTimeout(() => send(`Generate a pre-visit brief for patient ${selId}. Pull record, Selma check-in, search KB for their conditions. If you see critical findings requiring action (ED escalation, vascular referral, message to patient), call the appropriate tool.`, selId), 400);
  }, [selId, patient, view]);

  // ── Navigation helpers ──
  const openPatient = (id) => {
    setSelId(id); selRef.current = id; setView("patient"); setEvLog([]);
    // Re-attach any still-pending approvals for this patient to the fresh timeline.
    setTimeline(hitlRef.current.filter(x => x.patientId === id).map(x => ({ id:nid(), time:nowStr(), kind:"hitl-required", interruptId:x.interruptId, intercession:x, ts:x.ts })));
    loadDetail(id);
  };
  const goDashboard = () => { setView("dashboard"); };

  const guard = async (fn, what) => {
    try { return await fn(); }
    catch (e) { addEntry({ kind:"augi-error", text:`${what} failed: ${e?.message || "error"}`, ts:Date.now() }); return null; }
  };

  const startTelehealth = () => guard(async () => {
    const r = await api.req(`/api/patients/${selId}/telehealth/start`, {});
    setTeleSession({ sessionId: r.sessionId });
    setView("telehealth");
    addEntry({ kind:"telehealth-start", ts: Date.now() });
  }, "Starting telehealth");
  const endTelehealth = async (durationSec) => {
    const mins = Math.floor(durationSec/60), secs = durationSec%60;
    const durLabel = `${mins}:${String(secs).padStart(2,"0")}`;
    const sid = teleSession?.sessionId;
    setTelehealthLog(t => ({ ...t, [selId]: [...(t[selId]||[]), { duration:durLabel, endedAt:Date.now() }] }));
    addEntry({ kind:"telehealth-end", duration:durLabel, ts: Date.now() });
    setTeleSession(null);
    const res = await guard(() => api.req(`/api/patients/${selId}/telehealth/end`, { durationSec: Math.round(durationSec), sessionId: sid }), "Ending telehealth");
    if (res?.reviewRequired) { setReviewId(sid); setView("review"); loadSessions(selId); return; }
    setView("patient");
    if (res?.billing) addEntry({ kind:"billing-suggested", woundType: res.billing.woundType, codeCount: res.billing.codeCount, ts: Date.now() });
  };

  // ── Wounds & assessments ──
  const addWound = ({ type, location }) => guard(async () => {
    await api.req(`/api/patients/${selId}/wounds`, { type, location });
    setAddWoundOpen(false);
    addEntry({ kind:"wound-added", woundType:type, location, ts: Date.now() });
    await loadDetail(selId);
  }, "Adding wound");

  const saveAssessment = (woundId, fields) => guard(async () => {
    const wound = patient.wounds.find(w => w.id===woundId);
    const res = await api.req(`/api/patients/${selId}/wounds/${woundId}/assessments`, { ...fields, area: Number(fields.area) });
    setAssessmentTarget(null);
    addEntry({ kind:"assessment-recorded", woundType:wound.type, method:fields.method, push:res.push, ts: Date.now() });
    addEntry({ kind:"billing-suggested", woundType:wound.type, codeCount:res.billing.codeCount, ts: Date.now()+1 });
    await loadDetail(selId);
  }, "Saving assessment");

  // ── Billing review ──
  const approveBilling = (visitId, codes) => guard(async () => { await api.req(`/api/patients/${selId}/billing/${visitId}/approve`, { codes }); await loadDetail(selId); }, "Approving codes");
  const rejectBilling = (visitId, reason) => guard(async () => { await api.req(`/api/patients/${selId}/billing/${visitId}/reject`, { reason: reason || "Rejected by clinician" }); await loadDetail(selId); }, "Rejecting codes");

  const ackAlerts = () => guard(async () => { await api.req(`/api/patients/${selId}/alerts/ack`, {}); }, "Acknowledging alerts");
  const sendPlainMessage = (text) => guard(async () => { await api.req(`/api/patients/${selId}/messages`, { text }); }, "Sending message");

  // ── Morning triage on boot ──
  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    setTimeout(() => send("Give me a morning triage — who needs to be seen first and why? Flag anyone critical.", null), 700);
  }, []);


  // ── Timeline entry renderer ──
  function TimelineEntry({ entry }) {
    const isLast = timeline[timeline.length-1]?.id === entry.id;

    const dotStyle = (color, bg) => ({
      background: bg||`${color}18`, border:`1.5px solid ${color}`, color
    });

    if (entry.kind === "user") return (
      <div className="tl-entry">
        <div className="tl-icon-col">
          <div className="tl-dot" style={dotStyle("#0969da")}>Dr</div>
          {!isLast && <div className="tl-line"/>}
        </div>
        <div className="tl-body">
          <div className="tl-meta"><span className="tl-source" style={{ color:"#0969da" }}>Clinician</span><span>{entry.time}</span></div>
          <div className="user-msg">{entry.text}</div>
        </div>
      </div>
    );

    if (entry.kind === "augi-stream" || entry.kind === "augi-text") {
      const text = entry.text || entry.streaming || "";
      const isStreaming = entry.kind === "augi-stream" && !!entry.streaming;
      if (!text) return null;
      return (
        <div className="tl-entry">
          <div className="tl-icon-col">
            <div className="tl-dot" style={dotStyle("#8250df")}><Ic n="augi"/></div>
            {!isLast && <div className="tl-line"/>}
          </div>
          <div className="tl-body">
            <div className="tl-meta"><span className="tl-source" style={{ color:"#8250df" }}>Selma</span><span>{entry.time}</span></div>
            <div className={`augi-msg ${isStreaming?"augi-streaming":""}`}>
              <RichText text={text}/>{isStreaming && <span className="cursor"/>}
            </div>
          </div>
        </div>
      );
    }

    if (entry.kind === "tool-call") {
      const done = entry.done;
      return (
        <div className="tl-entry">
          <div className="tl-icon-col">
            <div className="tl-dot" style={dotStyle("#8250df","rgba(130,80,223,.06)")}><Ic n="cog"/></div>
            {!isLast && <div className="tl-line"/>}
          </div>
          <div className="tl-body">
            <div className="tl-meta"><span className="tl-source" style={{ color:"#8250df" }}>Selma</span><span>{entry.time}</span>{done && <span style={{ color:"#1a7f37", fontSize:"11px" }}><Ic n="check"/> done</span>}</div>
            <div style={{ background:"var(--s3)", borderRadius:7, padding:"6px 9px", fontSize:"12px", color:"#8250df" }}>
              {toolLabel(entry.toolName)}{!done && <span style={{ animation:"hpulse .7s infinite", display:"inline" }}> …</span>}
            </div>
          </div>
        </div>
      );
    }

    if (entry.kind === "hitl-required") {
      const { intercession } = entry;
      if (!intercession) return null;
      const resolved = entry.resolved;
      const meta = intercession.meta || { icon:"cog", label:intercession.toolName, urgency:"moderate" };
      const uc = urgColor(meta.urgency);
      const fields = HITL_FIELDS[intercession.toolName] || [];
      // Use live queue version for field values
      const liveItem = hitlQueue.find(x => x.interruptId===entry.interruptId) || intercession;
      const urgClass = { critical:"hitl-critical", high:"hitl-high", moderate:"hitl-moderate", low:"hitl-moderate" }[meta.urgency]||"hitl-moderate";

      return (
        <div className="tl-entry">
          <div className="tl-icon-col">
            <div className="tl-dot" style={{ background:`${uc}18`, border:`1.5px solid ${uc}`, color:uc, fontSize:"11px" }}><Ic n="pending"/></div>
            {!isLast && <div className="tl-line"/>}
          </div>
          <div className="tl-body">
            <div className="tl-meta">
              <span className="tl-source" style={{ color:uc }}>Approval needed</span>
              <span>{entry.time}</span>
              
            </div>
            {resolved ? (
              <div style={{ background: entry.approved?"rgba(26,127,55,.06)":"rgba(207,34,46,.06)", border:`1px solid ${entry.approved?"rgba(26,127,55,.25)":"rgba(207,34,46,.25)"}`, borderRadius:8, padding:"8px 10px", fontSize:"11px", color: entry.approved?"#1a7f37":"#cf222e" }}>
                {entry.approved ? <><Ic n="check"/> Approved — {meta.label}</> : <><Ic n="close"/> Rejected — {meta.label}</>}
              </div>
            ) : (
              <div className={`hitl-card ${urgClass}`}>
                <div className="hitl-hdr">
                  <span className="hitl-icon"><Ic n={meta.icon}/></span>
                  <div>
                    <div className="hitl-label" style={{ color:uc }}>{meta.label}</div>
                    <div className="hitl-node">Waiting for your decision</div>
                  </div>
                </div>
                {fields.map(f => (
                  <div key={f.id} className="hitl-field">
                    <div className="hitl-field-label">{f.label}</div>
                    {f.type==="textarea" ? (
                      <textarea rows={3} value={liveItem.fieldValues?.[f.id]||""} onChange={e => updateField(entry.interruptId,f.id,e.target.value)}/>
                    ) : f.type==="select" ? (
                      <select value={liveItem.fieldValues?.[f.id]||""} onChange={e => updateField(entry.interruptId,f.id,e.target.value)}>
                        <option value="">Select…</option>
                        {f.options?.map(o => <option key={o}>{o}</option>)}
                      </select>
                    ) : (
                      <input value={liveItem.fieldValues?.[f.id]||""} onChange={e => updateField(entry.interruptId,f.id,e.target.value)}/>
                    )}
                  </div>
                ))}
                <div className="hitl-note-row">
                  <textarea className="hitl-note" rows={1} placeholder="Clinician note for audit trail…" value={liveItem.note||""} onChange={e => setNote(entry.interruptId, e.target.value)}/>
                </div>
                <div className="hitl-btns">
                  <button className="hitl-approve" style={{ background: meta.urgency==="critical"?"#c0392b":"#238636" }} onClick={() => approve(entry.interruptId)}>
                    <Ic n="check"/> Approve &amp; execute
                  </button>
                  <button className="hitl-reject" onClick={() => reject(entry.interruptId)}><Ic n="close"/> Reject</button>
                </div>
                <div className="hitl-footer">Decision logged · agent resumes on approval</div>
              </div>
            )}
          </div>
        </div>
      );
    }

    // Bridge entries
    if (entry.kind === "bridge-alert") {
      const isCrit = entry.severity==="critical";
      return (
        <div className="tl-entry">
          <div className="tl-icon-col">
            <div className="tl-dot" style={dotStyle("#cf222e")}><Ic n="siren"/></div>
            {!isLast && <div className="tl-line"/>}
          </div>
          <div className="tl-body">
            <div className="tl-meta"><span className="tl-source" style={{ color:"#cf222e" }}>Selma alert</span><span>{entry.time}</span><span className={`pill ${isCrit?"p-red":"p-pur"}`} style={{ padding:"0 5px", fontSize:"11px" }}>{entry.severity}</span></div>
            <div className={`bridge-card bc-selma-alert`}>
              <div className="bc-label" style={{ color:"#cf222e" }}><Ic n="siren"/> Red flag from patient</div>
              <div className="bc-content">"{entry.alert}"</div>
              <div className="bc-actions">
                <button className="bc-btn bc-btn-g" onClick={() => { ackAlerts(); send(`Patient just reported a red flag: "${entry.alert}". What should I do immediately?`); }}>Acknowledge + Ask Selma</button>
              </div>
            </div>
          </div>
        </div>
      );
    }

    if (entry.kind === "bridge-checkin") {
      const d = entry.data || {};
      const qMap = { q0:"Pain", q1:"Change", q2:"Color", q3:"Exudate", q4:"Odor", q5:"Periwound", q6:"Steps done", q7:"Concern" };
      return (
        <div className="tl-entry">
          <div className="tl-icon-col">
            <div className="tl-dot" style={dotStyle("#8250df")}><Ic n="selma"/></div>
            {!isLast && <div className="tl-line"/>}
          </div>
          <div className="tl-body">
            <div className="tl-meta"><span className="tl-source" style={{ color:"#8250df" }}>Selma check-in</span><span>{entry.time}</span></div>
            <div className="bridge-card bc-selma-ci">
              <div className="bc-label" style={{ color:"#8250df" }}><Ic n="selma"/> Daily check-in received</div>
              <div className="ci-mini-grid">
                {Object.entries(d).slice(0,6).map(([k,v]) => (
                  <div key={k} className="ci-mini">
                    <div className="ci-mini-l">{qMap[k]||k}</div>
                    <div className="ci-mini-v" style={{ color: (k==="q0"&&parseInt(v)>=7)||(k==="q1"&&v==="Larger")?"#bc4c00":"#1f2328" }}>{v}</div>
                  </div>
                ))}
              </div>
              {d.q7 && <div style={{ marginTop:6, fontSize:"11px", color:"#57606a" }}>Concern: <span style={{ color:"#1f2328" }}>"{d.q7}"</span></div>}
              <div className="bc-actions">
                <button className="bc-btn bc-btn-b" onClick={() => send(`Review the Selma check-in I just received. Summarize findings and recommend any actions.`)}>Ask Selma to review</button>
                <button className="bc-btn bc-btn-p" onClick={() => { sendPlainMessage("Your care team received your check-in. Thank you for keeping us updated!"); }}>Acknowledge to patient</button>
              </div>
            </div>
          </div>
        </div>
      );
    }

    if (entry.kind === "bridge-message") return (
      <div className="tl-entry">
        <div className="tl-icon-col">
          <div className="tl-dot" style={dotStyle("#1a7f37")}><Ic n="message"/></div>
          {!isLast && <div className="tl-line"/>}
        </div>
        <div className="tl-body">
          <div className="tl-meta"><span className="tl-source" style={{ color:"#1a7f37" }}>Selma message</span><span>{entry.time}</span></div>
          <div className="bridge-card bc-selma-msg">
            <div className="bc-label" style={{ color:"#1a7f37" }}><Ic n="message"/> Patient message</div>
            <div className="bc-content">{entry.text || (entry.image && <><Ic n="attach"/> Wound photo: {entry.image.name}</>) || "—"}</div>
            <div className="bc-actions">
              <button className="bc-btn bc-btn-b" onClick={() => send(`Patient just messaged: "${entry.text}". How should I respond?`)}>Ask Selma →</button>
              <button className="bc-btn bc-btn-p" onClick={() => send(`Send a brief reassuring reply to ${patient?.name?.split(" ")[0]} about their message: "${entry.text}"`)}>Draft reply</button>
            </div>
          </div>
        </div>
      </div>
    );

    if (entry.kind === "bridge-step") return (
      <div className="tl-entry">
        <div className="tl-icon-col">
          <div className="tl-dot" style={dotStyle("#1a7f37")}><Ic n="done"/></div>
          {!isLast && <div className="tl-line"/>}
        </div>
        <div className="tl-body">
          <div className="tl-meta"><span className="tl-source" style={{ color:"#1a7f37" }}>Care plan</span><span>{entry.time}</span></div>
          <div className="bridge-card bc-selma-step">
            <div className="bc-label" style={{ color:"#1a7f37" }}><Ic n="done"/> Step completed by patient</div>
            <div className="bc-content">"{entry.step?.title}"</div>
          </div>
        </div>
      </div>
    );

    if (entry.kind === "bridge-telehealth-join") return (
      <div className="tl-entry">
        <div className="tl-icon-col"><div className="tl-dot" style={dotStyle("#0969da")}><Ic n="video"/></div>{!isLast&&<div className="tl-line"/>}</div>
        <div className="tl-body">
          <div className="tl-meta"><span className="tl-source" style={{ color:"#0969da" }}>Selma</span><span>{entry.time}</span></div>
          <div className="bridge-card" style={{ background:"rgba(9,105,218,.04)", borderColor:"rgba(9,105,218,.2)" }}>
            <div className="bc-label" style={{ color:"#0969da" }}><Ic n="video"/> {patient?.name} joined the telehealth waiting room</div>
          </div>
        </div>
      </div>
    );

    if (entry.kind === "wound-added") return (
      <div className="tl-entry">
        <div className="tl-icon-col"><div className="tl-dot" style={dotStyle("#8250df")}><Ic n="wound"/></div>{!isLast&&<div className="tl-line"/>}</div>
        <div className="tl-body">
          <div className="tl-meta"><span className="tl-source" style={{ color:"#8250df" }}>Wound record</span><span>{entry.time}</span></div>
          <div className="bridge-card bc-selma-step" style={{ background:"rgba(130,80,223,.04)", borderColor:"rgba(130,80,223,.2)" }}>
            <div className="bc-label" style={{ color:"#8250df" }}><Ic n="wound"/> New wound added — {entry.woundType} ({entry.location})</div>
          </div>
        </div>
      </div>
    );

    if (entry.kind === "assessment-recorded") return (
      <div className="tl-entry">
        <div className="tl-icon-col"><div className="tl-dot" style={dotStyle("#1a7f37")}><Ic n="plan"/></div>{!isLast&&<div className="tl-line"/>}</div>
        <div className="tl-body">
          <div className="tl-meta"><span className="tl-source" style={{ color:"#1a7f37" }}>Assessment</span><span>{entry.time}</span><span className="pill p-grn" style={{ padding:"0 5px", fontSize:"11px" }}>{entry.method}</span></div>
          <div className="bridge-card bc-selma-step">
            <div className="bc-label" style={{ color:"#1a7f37" }}><Ic n="plan"/> New assessment recorded — {entry.woundType}</div>
            <div className="bc-content">PUSH score {entry.push}/17 · via {entry.method}</div>
            <div className="bc-actions">
              <button className="bc-btn bc-btn-p" onClick={() => send(`Review the assessment I just recorded for ${patient?.name}'s ${entry.woundType} (PUSH ${entry.push}/17, via ${entry.method}). Any concerning trend or recommended change to the care plan?`)}>Ask Selma to review</button>
            </div>
          </div>
        </div>
      </div>
    );

    if (entry.kind === "billing-suggested") return (
      <div className="tl-entry">
        <div className="tl-icon-col"><div className="tl-dot" style={dotStyle("#0969da")}><Ic n="billing"/></div>{!isLast&&<div className="tl-line"/>}</div>
        <div className="tl-body">
          <div className="tl-meta"><span className="tl-source" style={{ color:"#0969da" }}>Billing</span><span>{entry.time}</span><span className="pill p-blu" style={{ padding:"0 5px", fontSize:"11px" }}>Coding suggestions</span></div>
          <div className="bridge-card" style={{ background:"rgba(9,105,218,.04)", borderColor:"rgba(9,105,218,.2)" }}>
            <div className="bc-label" style={{ color:"#0969da" }}><Ic n="billing"/> {entry.codeCount} code{entry.codeCount!==1?"s":""} suggested — {entry.woundType}</div>
            <div className="bc-content">Visit note generated and codes suggested. Pending clinician review in Billing &amp; Audit.</div>
            <div className="bc-actions">
              <button className="bc-btn bc-btn-b" onClick={() => setView("billing")}>Review in Billing &amp; Audit</button>
            </div>
          </div>
        </div>
      </div>
    );

    if (entry.kind === "telehealth-start") return (
      <div className="tl-entry">
        <div className="tl-icon-col"><div className="tl-dot" style={dotStyle("#1a7f37")}><Ic n="video"/></div>{!isLast&&<div className="tl-line"/>}</div>
        <div className="tl-body">
          <div className="tl-meta"><span className="tl-source" style={{ color:"#1a7f37" }}>Telehealth</span><span>{entry.time}</span></div>
          <div className="bridge-card bc-selma-step">
            <div className="bc-label" style={{ color:"#1a7f37" }}><Ic n="video"/> Video visit started with {patient?.name}</div>
          </div>
        </div>
      </div>
    );

    if (entry.kind === "telehealth-end") return (
      <div className="tl-entry">
        <div className="tl-icon-col"><div className="tl-dot" style={dotStyle("#57606a")}><Ic n="end-call"/></div>{!isLast&&<div className="tl-line"/>}</div>
        <div className="tl-body">
          <div className="tl-meta"><span className="tl-source" style={{ color:"#57606a" }}>Telehealth</span><span>{entry.time}</span></div>
          <div className="bridge-card" style={{ background:"var(--s3)", borderColor:"var(--bd)" }}>
            <div className="bc-label" style={{ color:"var(--tx2)" }}><Ic n="end-call"/> Visit ended · duration {entry.duration}</div>
            <div className="bc-actions">
              <button className="bc-btn bc-btn-p" onClick={() => send(`Summarize the telehealth visit I just completed with ${patient?.name} and suggest any follow-up documentation or billing codes.`)}>Ask Selma to summarize</button>
            </div>
          </div>
        </div>
      </div>
    );

    if (entry.kind === "augi-error") return (
      <div className="tl-entry">
        <div className="tl-icon-col"><div className="tl-dot" style={dotStyle("#cf222e")}>!</div>{!isLast&&<div className="tl-line"/>}</div>
        <div className="tl-body">
          <div className="tl-meta"><span className="tl-source" style={{ color:"#cf222e" }}>Error</span><span>{entry.time}</span></div>
          <div style={{ background:"rgba(207,34,46,.07)", border:"1px solid rgba(207,34,46,.25)", borderRadius:8, padding:"8px 10px", fontSize:"11px", color:"#cf222e" }}>{entry.text}</div>
        </div>
      </div>
    );

    return null;
  }

  const QUICK = patient ? [
    `Brief: ${patient.name.split(" ")[0]}`,
    `Selma check-in`,
    `KB: ${patient.woundType.split(" ").slice(0,2).join(" ")}`,
    "Escalate to ED?",
    "Vascular referral",
    "Morning triage",
  ] : ["Morning triage","Most critical","Who is waiting?"];

  
  return (
    <>
      <style>{css}</style>
      <BridgeCtx.Provider value={bridge}>
      <div className={`app${augiOpen ? " augi-open" : ""}`}>

        {/* TOP BAR */}
        <div className="topbar">
          <div className="tb-brand"><img className="brand-logo" src="/unwound-logo-white.png" alt="unwound.ai" width="120" height="21"/><span className="tb-div" aria-hidden/><span className="tb-prod">Selma <span className="tb-prod-sub">Clinician</span></span></div>
          <div style={{ display:"flex", gap:5, flexWrap:"wrap", alignItems:"center" }}>
            {hitlQueue.length > 0 && <span className="pill p-red tb-pending" style={{ animation:"hpulse 1.6s ease-in-out infinite" }}><Ic n="pending"/> {hitlQueue.length} pending</span>}
          </div>
          <div className="tb-actions">
            <NotificationBell api={api} audience="clinician" subscribe={cb => bridge.subscribe(CH.NOTIFY, cb)}
              onOpen={it => { if (it.link?.patientId) openPatient(it.link.patientId); if (it.kind === "approval") setSelmaOpen(true); }}/>
            <button className="tb-augi" onClick={() => setSelmaOpen(o => !o)} aria-expanded={augiOpen} aria-controls="augi-panel">
              <Ic n="augi"/> Selma{hitlQueue.length > 0 && <span className="tb-badge" aria-label={`${hitlQueue.length} approvals pending`}>{hitlQueue.length}</span>}
            </button>
            <div style={{ width:6, height:6, borderRadius:"50%", background:live?"var(--grn)":"var(--yel)", animation:"pulse 2s infinite" }}/>
            <span className="tb-live-text">{live ? "Live sync connected" : "Reconnecting…"}</span>
            <span className="tb-sep" style={{ color:"var(--tx3)" }}>|</span>
            <span className="tb-date">{new Date().toLocaleDateString("en-US",{ weekday:"short", month:"short", day:"numeric" })}</span>
            <button className="tb-signout" onClick={onLogout}>Sign out<span className="tb-user"> · {user.name}</span></button>{loadErr && <span style={{ color:"var(--red)" }}>{loadErr}</span>}
          </div>
        </div>
        <div className="augi-scrim" onClick={() => setSelmaOpen(false)}/>

        {/* PATIENT SIDEBAR */}
        <aside className="sidebar">
          <div className="nav-row">
            <div className={`nav-btn ${view==="dashboard"?"navsel":""}`} {...kb(goDashboard)}>
              <span><Ic n="dashboard"/></span><span>Dashboard</span>
            </div>
          </div>
          <div className="sh">Today · {sorted.length} patients</div>
          {sorted.map(p => (
            <div key={p.id} className={`pt ${p.id===selId&&view!=="dashboard"?"sel":""}`} {...kb(() => openPatient(p.id))} aria-current={p.id===selId&&view!=="dashboard"?"true":undefined}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:3 }}>
                <div style={{ fontWeight:600, fontSize:12 }}>{p.name}</div>
                <UBadge u={p.urgency}/>
              </div>
              <div style={{ fontSize:11, color:"var(--tx2)", marginBottom:3 }}>{p.age} · {p.woundType.split(" ").slice(0,3).join(" ")}</div>
              <div style={{ display:"flex", gap:5, alignItems:"center", marginBottom:3 }}>
                <SBadge s={p.visitStatus}/>
                {p.visitStatus==="waiting"&&<span style={{ fontSize:11, color:"var(--yel)" }}><Ic n="timer"/>{p.waitMins}m</span>}
              </div>
              {p.alerts[0]&&<div style={{ fontSize:11, color:"var(--red)", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}><Ic n="flag"/> {p.alerts[0].slice(0,46)}</div>}
              <div className="adh"><div className="adh-f" style={{ width:`${p.adherence}%`, background:p.adherence>=70?"var(--grn)":p.adherence>=40?"var(--yel)":"var(--red)" }}/></div>
            </div>
          ))}
        </aside>

        {/* MAIN PATIENT VIEW */}
        <main className="main">
          {view==="dashboard" && (
            <DashboardView patients={sorted} onOpenPatient={openPatient} telehealthLog={telehealthLog}/>
          )}

          {view==="review" && patient && patient.detailLoaded && reviewId && (
            <ScribeReview key={reviewId} patient={patient} sessionId={reviewId} onBack={() => setView("patient")}
              onConfirmed={async (r) => { addEntry({ kind:"billing-suggested", woundType:r.billing.woundType, codeCount:r.billing.codeCount, ts:Date.now() }); await loadDetail(selId); loadSessions(selId); setView("billing"); }}
              onDiscarded={async (r) => { await loadDetail(selId); loadSessions(selId); setView("patient"); }}/>
          )}

          {view==="telehealth" && patient && teleSession && (
            <TelehealthView key={teleSession.sessionId} sessionId={teleSession.sessionId} patient={patient} onEnd={endTelehealth} onBack={() => setView("patient")} onRecordAssessment={(woundId) => setAssessmentTarget({ woundId, method:"Telehealth" })}/>
          )}

          {view==="billing" && patient && patient.detailLoaded && (
            <BillingAuditView patient={patient} onApprove={approveBilling} onReject={rejectBilling} onBack={() => setView("patient")}/>
          )}

          {view==="patient" && patient && !patient.detailLoaded && <div style={{ padding:24 }} aria-busy="true" aria-label="Loading patient record"><div className="skeleton skeleton-line w60" style={{ height:22 }}/><div className="skeleton skeleton-line w80"/><div className="skeleton skeleton-card" style={{ marginTop:14 }}/><div className="skeleton skeleton-card" style={{ marginTop:10 }}/></div>}
          {view==="patient" && patient && patient.detailLoaded && <>
            <div className="pt-hero">
              <div style={{ display:"flex", alignItems:"flex-start", gap:10 }}>
                <div style={{ width:42, height:42, borderRadius:"50%", background:`${urgColor(patient.urgency)}18`, border:`2px solid ${urgColor(patient.urgency)}`, display:"flex", alignItems:"center", justifyContent:"center", fontWeight:700, fontSize:15, color:urgColor(patient.urgency), flexShrink:0 }}>{patient.name.split(" ").map(n=>n[0]).join("")}</div>
                <div style={{ flex:1 }}>
                  <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:3, flexWrap:"wrap" }}>
                    <span onClick={goDashboard} style={{ fontSize:11, color:"var(--acc)", cursor:"pointer", fontWeight:600 }}>← Dashboard</span>
                  </div>
                  <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:8, flexWrap:"wrap" }}>
                    <div style={{ fontSize:16, fontWeight:600, marginBottom:3 }}>{patient.name}</div>
                    <div className="hero-actions">
                      <button className="bill-launch-btn" onClick={() => setView("billing")}><Ic n="billing"/> Billing &amp; Audit{patient.billing.some(b=>b.status==="pending") ? ` (${patient.billing.filter(b=>b.status==="pending").length})` : ""}</button>
                      <button className="th-launch-btn" onClick={startTelehealth}><Ic n="video"/> Start Telehealth Visit</button>
                    </div>
                  </div>
                  <div style={{ display:"flex", gap:5, flexWrap:"wrap", marginBottom:4 }}>
                    <UBadge u={patient.urgency}/><SBadge s={patient.visitStatus}/>
                    {patient.visitStatus==="waiting"&&<span style={{ fontSize:11, color:"var(--yel)" }}><Ic n="timer"/>{patient.waitMins}m</span>}
                    {telehealthLog[selId]?.length>0 && <span className="pill p-grn"><Ic n="video"/> {telehealthLog[selId].length} telehealth visit{telehealthLog[selId].length>1?"s":""}</span>}
                  </div>
                  <div style={{ fontSize:11, color:"var(--tx2)", display:"flex", gap:8, flexWrap:"wrap" }}>
                    <span>{patient.mrn}</span><span>·</span><span>{patient.age} · {patient.gender}</span><span>·</span><span>{patient.insurance}</span>
                    {patient.allergies.length>0&&<><span>·</span><span style={{ color:"var(--red)" }}><Ic n="warn"/> {patient.allergies.join(", ")}</span></>}
                  </div>
                </div>
              </div>
            </div>
            {patient.alerts.length>0&&(
              <div className="alerts-strip">
                {patient.alerts.map((a,i)=><div key={i} className={`ar ${i===0&&patient.urgency==="critical"?"arc":i===0?"arh":"arm"}`}><span>{i===0&&patient.urgency==="critical"?<Ic n="siren"/>:<Ic n="warn"/>}</span><span>{a.replace(/^(🚨|⚠️?)\s*/u, "")}</span></div>)}
              </div>
            )}
            {teleSessions.filter(x => x.status === "review").map(x => (
              <div key={x.id} className="alerts-strip"><div className="ar arh" style={{ display:"flex", justifyContent:"space-between", alignItems:"center", gap:8 }}>
                <span><Ic n="note"/> Visit transcript from {new Date(x.startedAt).toLocaleString()} is awaiting your review — no codes have been generated yet.</span>
                <button className="bc-btn bc-btn-p" onClick={() => { setReviewId(x.id); setView("review"); }}>Review</button></div></div>
            ))}
            <div className="wounds-sec">
              <div className="wounds-sec-hdr">
                <div className="dash-section-lbl" style={{ margin:0 }}><Ic n="wound"/> Wounds · {patient.wounds.length}</div>
                <button className="add-wound-btn" onClick={() => setAddWoundOpen(true)}>+ Add wound</button>
              </div>
              {patient.wounds.map(w => {
                const last = w.assessments[w.assessments.length-1];
                return (
                  <div key={w.id} className="wound-card">
                    <div className="wound-card-hdr">
                      <div>
                        <div className="wound-name">{w.type}</div>
                        <div className="wound-loc">{w.location}</div>
                      </div>
                      <div className="wound-actions">
                        <button className="wound-btn" onClick={() => setAssessmentTarget({ woundId:w.id, method:"In-person" })}><Ic n="exam"/> In-person assessment</button>
                        <button className="wound-btn primary" onClick={() => setAssessmentTarget({ woundId:w.id, method:"Telehealth" })}><Ic n="video"/> Telehealth assessment</button>
                      </div>
                    </div>
                    {last ? (
                      <div style={{ display:"flex", gap:14, flexWrap:"wrap", fontSize:11 }}>
                        <span>PUSH <b style={{ color: last.push>=15?"var(--red)":last.push>=10?"var(--org)":"var(--grn)" }}>{last.push}/17</b></span>
                        <span>Area <b>{last.area} cm²</b></span>
                        <span>Tissue <b>{last.tissueType}</b></span>
                        <span>Exudate <b>{last.exudateAmount}</b></span>
                        <span style={{ color:"var(--tx3)" }}>{last.date} · {last.method}</span>
                      </div>
                    ) : (
                      <div style={{ fontSize:11, color:"var(--tx3)" }}>No assessments recorded yet.</div>
                    )}
                    {w.assessments.length>1 && (
                      <div className="wound-hist">
                        {w.assessments.slice(0,-1).slice(-3).reverse().map(a => (
                          <div key={a.id} className="wound-hist-row">
                            <span>{a.date} · {a.method}</span>
                            <span>PUSH <b>{a.push}/17</b></span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            <CarePanels patient={patient}/>
            <div className="cards">
              <div className="card">
                <div className="ct"><Ic n="plan"/> Assessment · {patient.lastAssessment.date}</div>
                <div className="kv"><span className="kk">PUSH</span><span className={`kv-v ${patient.lastAssessment.push>=15?"danger":patient.lastAssessment.push>=10?"warn":""}`}>{patient.lastAssessment.push}/17</span></div>
                <div className="pb"><div className="pf" style={{ width:`${(patient.lastAssessment.push/17)*100}%`, background:patient.lastAssessment.push>=15?"var(--red)":patient.lastAssessment.push>=10?"var(--org)":"var(--yel)" }}/></div>
                {[["Area",patient.lastAssessment.area+" cm²",""],["Tissue",patient.lastAssessment.tissueType,""],["Exudate",patient.lastAssessment.exudate,""],["Pain",patient.lastAssessment.painScore+"/10",patient.lastAssessment.painScore>=7?"warn":""]].map(([k,v,c])=><div key={k} className="kv" style={{ marginTop:4 }}><span className="kk">{k}</span><span className={`kv-v ${c}`}>{v}</span></div>)}
                {patient.lastAssessment.infectionSigns.length>0&&<div className="kv" style={{ marginTop:4 }}><span className="kk">Infection</span><span className="kv-v danger">{patient.lastAssessment.infectionSigns.slice(0,3).join(", ")}</span></div>}
              </div>
              <div className="card">
                <div className="ct"><Ic n="labs"/> Labs</div>
                {[["ABI",patient.lastAssessment.abi,v=>parseFloat(v)<0.8?"danger":"ok"],["Albumin",patient.lastAssessment.albumin&&patient.lastAssessment.albumin+" g/dL",v=>parseFloat(v)<3.5?"danger":"ok"],["HbA1c",patient.lastAssessment.hba1c&&patient.lastAssessment.hba1c+"%",v=>parseFloat(v)>7.5?"warn":"ok"],["Glucose",patient.lastAssessment.glucose&&patient.lastAssessment.glucose+" mg/dL",v=>parseFloat(v)>180?"warn":"ok"]].map(([k,v,f])=><div key={k} className="kv"><span className="kk">{k}</span><span className={`kv-v ${v?f(v):"muted"}`}>{v||"—"}</span></div>)}
                <div style={{ borderTop:"1px solid var(--bd)", marginTop:6, paddingTop:6 }}>{patient.pmh.slice(0,3).map((h,i)=><div key={i} style={{ fontSize:11, color:"var(--tx2)", marginBottom:2 }}>• {h}</div>)}</div>
              </div>
              {patient.selmaCheckIn?.completed&&(
                <div className="card cf" style={{ background:"rgba(130,80,223,.03)", border:"1px solid rgba(130,80,223,.15)" }}>
                  <div className="ct" style={{ color:"var(--pur)" }}><Ic n="selma"/> Selma check-in · {new Date(patient.selmaCheckIn.completedAt).toLocaleString()} · Adherence: <span style={{ color:patient.adherence>=70?"var(--grn)":patient.adherence>=40?"var(--yel)":"var(--red)" }}>{patient.adherence}%</span></div>
                  <div className="ci-grid">
                    {[["Pain",patient.selmaCheckIn.painScore+"/10"],["Change",patient.selmaCheckIn.woundChange],["Color",patient.selmaCheckIn.woundColor],["Exudate",patient.selmaCheckIn.exudate],["Odor",patient.selmaCheckIn.odor],["Periwound",patient.selmaCheckIn.periwound],["Steps",patient.selmaCheckIn.stepsDone],["Photo",patient.selmaCheckIn.hasPhoto?<Ic n="check"/>:"No"],["Concern",patient.selmaCheckIn.concern]].map(([l,a])=>(
                      <div key={l} className="ci-q"><div className="ci-l">{l}</div><div className="ci-a" style={{ color:(l==="Pain"&&parseInt(a)>=7)||(l==="Change"&&a==="Larger")||(l==="Periwound"&&a.toLowerCase().includes("streak"))?"var(--org)":"var(--tx)" }}>{a}</div></div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </>}
        </main>

        {/* ══ UNIFIED AUGI + BRIDGE PANEL ══ */}
        <aside className="augi-panel" id="augi-panel" aria-label="Selma assistant">

          {/* Header */}
          <div className="ap-hdr">
            <div className="augi-av"><img src="/augi-icon.png" alt="" width="32" height="32"/></div>
            <div className="ap-meta">
              <div className="ap-name">Selma</div>
              <div className="ap-sub">Patient activity and Selma, in one timeline</div>
            </div>
            <div className="ap-badges">
              {hitlQueue.length > 0 && <span className="pill p-red" style={{ animation:"hpulse 1.6s ease-in-out infinite", cursor:"pointer" }}><Ic n="pending"/> {hitlQueue.length} awaiting approval</span>}
              <span className="pill p-grn" style={{ display:"flex", alignItems:"center", gap:3 }}><div style={{ width:5, height:5, borderRadius:"50%", background:"var(--grn)", animation:"pulse 1.5s infinite" }}/>live</span>
              <button className="ap-close" onClick={() => setSelmaOpen(false)} aria-label="Close Selma"><Ic n="close"/></button>
            </div>
          </div>

          {/* Active tools */}
          {activeTools.filter(t=>t.status==="running").length > 0 && (
            <div className="tool-bar">
              {activeTools.filter(t=>t.status==="running").map(t => (
                <div key={t.id} className="tool-pill"><div className="tspin"/><span>{toolLabel(t.name)}</span></div>
              ))}
            </div>
          )}

          {/* ── UNIFIED TIMELINE ── */}
          <div className="timeline">
            {timeline.length===0 && !isRunning && (
              <div style={{ textAlign:"center", padding:"32px 16px", color:"var(--tx3)" }}>
                <div style={{ fontSize:32, marginBottom:10 }}><Ic n="augi"/></div>
                <div style={{ fontSize:12, marginBottom:4 }}>Selma initializing…</div>
                <div style={{ fontSize:11 }}>Patient check-ins and messages, Selma's analysis and your approvals all appear here in one timeline.</div>
              </div>
            )}
            {timeline.filter(e => e.kind !== "augi-run-start").map(entry => (
              <TimelineEntry key={entry.id} entry={entry} />
            ))}
            {isRunning && Object.keys(streamMap).length===0 && activeTools.filter(t=>t.status==="running").length===0 && (
              <div style={{ display:"flex", gap:6, alignItems:"flex-start", marginBottom:12 }}>
                <div className="tl-icon-col" style={{ width:28 }}><div className="tl-dot" style={{ background:"rgba(130,80,223,.08)", border:"1.5px solid #8250df", color:"#8250df", fontSize:"13px" }}><Ic n="augi"/></div></div>
                <div style={{ paddingTop:4 }}><div className="typing"><div className="d"/><div className="d"/><div className="d"/></div></div>
              </div>
            )}
            <div ref={endRef}/>
          </div>

          {/* HITL audit log */}
          {hitlHistory.length > 0 && (
            <div style={{ borderTop:"1px solid var(--bd)", padding:"8px 12px", background:"var(--bg)", flexShrink:0, maxHeight:100, overflowY:"auto" }}>
              <div style={{ fontSize:"11px", fontWeight:700, color:"var(--tx3)", textTransform:"uppercase", letterSpacing:".06em", marginBottom:5 }}>Decision log · {hitlHistory.length} decisions</div>
              {hitlHistory.slice().reverse().map((h,i) => (
                <div key={i} className="audit-entry">
                  <span className="audit-icon">{h.approved?<Ic n="done"/>:<Ic n="rejected"/>}</span>
                  <span className="audit-text">{h.approved?"Approved":"Rejected"}{h.action ? ` — ${h.action}` : ""}</span>
                  <span className="audit-time">{new Date(h.decidedAt).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})}</span>
                </div>
              ))}
            </div>
          )}

          {/* Input */}
          <div className="inp-area">
            <div className="qbs">
              {QUICK.map(q => <button key={q} className="qb" onClick={() => send(q)} disabled={isRunning}>{q}</button>)}
            </div>
            <div className="inp-row">
              <textarea className="augi-inp" rows={1} value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => { if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();send(input);} }} placeholder="Ask Selma — all activity in one timeline…"/>
              <button className="send-btn" aria-label="Send" onClick={() => send(input)} disabled={isRunning||!input.trim()}><Ic n="send"/></button>
            </div>
            <div className="inp-footer">Selma suggests, you decide. Changes to care need your approval.</div>
          </div>
        </aside>

      </div>

      {assessmentTarget && patient && (
        <AssessmentModal
          patient={patient}
          wound={patient.wounds.find(w => w.id===assessmentTarget.woundId)}
          defaultMethod={assessmentTarget.method}
          onSave={saveAssessment}
          onCancel={() => setAssessmentTarget(null)}
        />
      )}
      {addWoundOpen && patient && (
        <AddWoundModal
          patientName={patient.name}
          onSave={addWound}
          onCancel={() => setAddWoundOpen(false)}
        />
      )}
      </BridgeCtx.Provider>
    </>
  );
}

