// Selma (clinician) — hierarchy, readability, responsive layout and micro-interactions.
// Loaded AFTER the component styles in App.tsx so it can refine them without touching component markup.
// Breakpoints:  ≥1280 full 3-column · 1024–1279 narrower rails · <1024 single column + Selma drawer · <640 phone.
export const POLISH_CSS = `
html,body{height:100%;overflow:hidden}
body{font-size:var(--fs-md);line-height:var(--lh)}

/* ───────────── 1. VISUAL HIERARCHY ─────────────
   One primary action per surface (solid), secondary = outline/tint, tertiary = ghost text. Destructive = outline until confirmed. */
.th-launch-btn,.af-save,.hitl-approve,.big-cta{background:var(--grn);color:#fff;border:1px solid transparent;border-radius:var(--r);font-weight:700;letter-spacing:.005em;box-shadow:0 1px 2px rgba(17,92,39,.35),inset 0 1px 0 rgba(255,255,255,.14);transition:var(--t)}
.th-launch-btn{padding:9px 16px;font-size:var(--fs-sm)}
.th-launch-btn:hover,.af-save:hover,.hitl-approve:hover{background:var(--grn-h)}
.af-save{padding:11px;font-size:var(--fs-md)}
.af-save:disabled,.hitl-approve:disabled{opacity:.55;box-shadow:none}
.hitl-approve{padding:10px;font-size:var(--fs-sm)}
/* secondary */
.bill-launch-btn,.th-assess-btn,.wound-btn.primary,.bc-btn-b,.bc-btn-p,.af-cancel,.hitl-reject{background:var(--s1);border:1px solid var(--bd2);color:var(--tx);border-radius:var(--r);font-weight:600;transition:var(--t)}
.bill-launch-btn{padding:8px 14px;font-size:var(--fs-sm)}
.bill-launch-btn:hover,.th-assess-btn:hover,.wound-btn.primary:hover,.af-cancel:hover{background:var(--s3);border-color:var(--tx3)}
.th-assess-btn{padding:8px 12px;color:var(--pur);border-color:rgba(116,71,198,.4)}.th-assess-btn:hover{background:rgba(116,71,198,.08);border-color:var(--pur)}
.wound-btn.primary{color:var(--acc);border-color:rgba(8,94,196,.4)}.wound-btn.primary:hover{background:rgba(8,94,196,.07);border-color:var(--acc)}
.bc-btn-b{color:var(--acc);border-color:rgba(8,94,196,.35)}.bc-btn-b:hover{background:rgba(8,94,196,.08)}
.bc-btn-p{color:var(--pur);border-color:rgba(116,71,198,.35)}.bc-btn-p:hover{background:rgba(116,71,198,.08)}
.af-cancel{padding:11px;font-size:var(--fs-md);color:var(--tx2)}
.hitl-reject{color:var(--red);border-color:rgba(188,31,42,.45)}.hitl-reject:hover{background:rgba(188,31,42,.08);border-color:var(--red)}
/* sign-out was a bright green button: it is a tertiary action */
.tb-signout{background:transparent;border:1px solid transparent;color:var(--tx2);border-radius:var(--r-sm);padding:6px 10px;font-size:var(--fs-sm);font-weight:600;transition:var(--t);white-space:nowrap}
.tb-signout:hover{background:var(--s3);color:var(--tx)}
/* tertiary / ghost */
.wound-btn,.bill-toggle,.dcard-btn,.modal-close,.qb{transition:var(--t)}
.wound-btn{background:transparent;border-color:transparent;color:var(--tx2);font-size:var(--fs-xs)}.wound-btn:hover{background:var(--s3);color:var(--tx)}
.bill-toggle{font-size:var(--fs-xs);color:var(--acc)}.bill-toggle:hover{text-decoration:underline}
.modal-close{width:32px;height:32px;border-radius:var(--r-sm);font-size:var(--fs-lg);color:var(--tx2)}.modal-close:hover{background:var(--s3);color:var(--tx)}
.add-wound-btn{border-color:var(--bd2);transition:var(--t)}
.bc-btn-g{background:var(--grn);color:#fff}.bc-btn-g:hover{background:var(--grn-h)}
.bc-btn-r{border-color:rgba(188,31,42,.45)!important}
/* dev-facing chrome (protocol badges, graph, event chips) recedes; clinical content leads */
.tb-dev{display:flex;gap:5px;align-items:center;opacity:.72}
.tb-dev .pill{font-weight:600}
.node-bar,.ev-strip{opacity:.8;background:var(--s2)}
.node-chip,.ec{font-size:var(--fs-xs)}
.ap-sub{color:var(--tx3)}
.inp-footer,.hitl-footer{opacity:.85}
/* primary KPI numbers lead, labels follow */
.stat-num{font-size:var(--fs-2xl);letter-spacing:-.01em}
.stat-lbl{font-size:var(--fs-xs);color:var(--tx2)}
.dash-title{font-size:var(--fs-xl);letter-spacing:-.01em}
.pt-hero .name,.wound-name{letter-spacing:-.005em}
/* alert strip: severity leads (critical solid-ish, others quieter) */
.arc{border-left:3px solid var(--red);font-weight:600}
.arh{border-left:3px solid var(--org)}
.arm{border-left:3px solid var(--yel);background:rgba(134,90,0,.06)}
.ar{font-size:var(--fs-sm);line-height:1.5;border-radius:var(--r-sm)}
/* selected row is obvious, hover is quiet */
.pt{transition:var(--t)}.pt:hover{background:var(--s3)}
.pt.sel{background:rgba(8,94,196,.07);box-shadow:inset 3px 0 0 var(--acc);border-left:0;padding-left:12px}
.nav-btn{transition:var(--t)}

/* ───────────── 2. READABILITY ───────────── */
.dash-sub,.modal-sub,.wound-loc,.dcard-meta{font-size:var(--fs-sm);color:var(--tx2);line-height:var(--lh)}
.dcard-name{font-size:var(--fs-md)}.dcard-alert{font-size:var(--fs-xs)}
.dcard-btn{font-size:var(--fs-xs);color:var(--acc)}
.kk,.kv-v,.wound-hist-row,.audit-log-detail{font-size:var(--fs-sm)}
.ct,.af-label,.hitl-field-label,.ci-l,.ci-mini-l,.dash-section-lbl,.sh{font-size:var(--fs-xs);letter-spacing:.06em;color:var(--tx3)}
.bdg,.pill,.bill-status{font-size:var(--fs-xs);line-height:1.5}
.pill{padding:2px 8px}
.bdg{padding:1px 8px}
.ci-a,.ci-mini-v{font-size:var(--fs-sm);line-height:1.5}
.bill-code-desc,.bill-code-reason,.bill-ev,.audit-time,.audit-text,.tl-meta,.bill-entity-chip,.audit-log-meta{font-size:var(--fs-xs);line-height:1.55}
.bill-code-reason{color:var(--tx2)}
.audit-hash{opacity:1;color:var(--tx3)}
.bill-transcript-text{font-size:var(--fs-xs);line-height:1.75}
/* running text: comfortable size + 65ch measure */
.augi-msg,.bc-content,.th-cap,.bill-code-reason,.audit-log-detail,.hitl-field,.ar span:last-child,.dash-sub,.modal-sub,.rv-turn textarea,.consent-card{max-width:var(--measure)}
.augi-msg{font-size:var(--fs-md);line-height:1.65;padding:10px 13px}
.user-msg{background:var(--acc);font-size:var(--fs-md);line-height:1.6;padding:9px 13px;max-width:min(88%,var(--measure))}
.bc-content{font-size:var(--fs-sm);line-height:1.6;color:var(--tx2)}
.th-cap{font-size:var(--fs-md);line-height:1.6;color:#f0f4f8}.th-cap.partial{opacity:.7}.th-cap b{font-size:var(--fs-xs)}
.rv-turn textarea{font-size:var(--fs-md);line-height:1.6}
.rv-who{font-size:var(--fs-xs);flex-basis:70px}
.hitl-field textarea,.hitl-field input,.hitl-field select,.hitl-note{font-size:var(--fs-sm)}
.hitl-label{font-size:var(--fs-xs)}.hitl-node{font-size:var(--fs-xs)}
.af-field input,.af-field select,.af-field textarea{font-size:var(--fs-md);padding:9px 11px;transition:var(--t)}
.af-chip,.af-method-btn{font-size:var(--fs-sm);transition:var(--t)}
.af-chip{padding:6px 12px}.af-chip:hover{background:var(--s3)}.af-method-btn:hover{background:var(--s3)}
.augi-inp{font-size:var(--fs-md);line-height:1.5;padding:9px 14px;transition:var(--t)}
.qb{font-size:var(--fs-xs);padding:4px 10px;color:var(--pur)}
.bnav-item,.tl-source{font-size:var(--fs-xs)}
.ec.eh{animation:hpulse 1.6s ease-in-out infinite}

/* ───────────── 3. MICRO-INTERACTIONS ───────────── */
.card,.stat-card,.wound-card,.bill-card{transition:box-shadow .16s var(--ease),border-color .16s var(--ease)}
.dcard{transition:var(--t);box-shadow:var(--sh1)}
.dcard:hover{border-color:var(--acc);box-shadow:var(--sh2);transform:translateY(-1px)}
.dcard:active{transform:none}
.th-ctrl-btn{transition:var(--t)}.th-ctrl-btn:hover{background:var(--s3);border-color:var(--bd2)}.th-ctrl-btn.end:hover{background:var(--red-h)}
.send-btn{background:var(--pur);transition:var(--t)}.send-btn:hover{background:var(--pur-h);transform:none}.send-btn:disabled{background:var(--tx3);opacity:.35}
.hitl-banner{transition:var(--t)}
.modal-backdrop{animation:ui-fade-in .16s var(--ease) both}
.modal-panel{animation:ui-fade-in .2s var(--ease) both}
.tl-entry,.hitl-card{animation:fadeUp .22s var(--ease) both}
.bill-tab{transition:var(--t)}
/* typing indicator: fade, don't bounce */
.d{animation:dotfade 1.2s ease-in-out infinite}
@keyframes dotfade{0%,100%{opacity:.25}50%{opacity:.9}}
@keyframes bncx{0%,100%{opacity:.25}50%{opacity:.9}}
/* empty + loading helpers used by views */
.main .empty-state,.timeline .empty-state{min-height:160px}

/* ───────────── 4. RESPONSIVE LAYOUT ───────────── */
.app{height:100dvh;grid-template-columns:224px minmax(0,1fr) clamp(340px,28vw,420px)}
.main,.sidebar,.augi-panel{min-height:0}
.tb-augi,.ap-close{display:none}
.tb-augi{align-items:center;gap:6px;background:var(--s1);border:1px solid var(--bd2);border-radius:var(--r);padding:6px 11px;font-size:var(--fs-sm);font-weight:700;color:var(--pur);position:relative;transition:var(--t)}
.tb-augi:hover{background:rgba(116,71,198,.07)}
.tb-badge{background:var(--red);color:#fff;border-radius:10px;font-size:var(--fs-xs);font-weight:700;line-height:1;padding:3px 6px;animation:hpulse 1.6s ease-in-out infinite}
.ap-close{width:32px;height:32px;border-radius:var(--r-sm);border:none;background:transparent;color:var(--tx2);font-size:var(--fs-lg);align-items:center;justify-content:center;transition:var(--t)}
.ap-close:hover{background:var(--s3)}
.tb-actions{display:flex;gap:8px;align-items:center;font-size:var(--fs-sm);color:var(--tx2);min-width:0}
.hero-actions{display:flex;gap:8px;flex-wrap:wrap}
.augi-scrim{display:none}

@media (max-width:1279px){
  .app{grid-template-columns:200px minmax(0,1fr) 340px}
  .tb-dev{display:none}
  .stat-row{grid-template-columns:repeat(2,1fr)}
  .cards{grid-template-columns:1fr}
}

/* Tablet + phone: patient rail becomes a horizontal strip; Selma becomes a slide-over drawer (with a pending-approval badge on its button) */
@media (max-width:1023px){
  .app{grid-template-columns:minmax(0,1fr);grid-template-rows:48px auto minmax(0,1fr)}
  .topbar{padding:0 12px}
  .tb-augi{display:inline-flex}
  .tb-pending{display:none}
  .sidebar{flex-direction:row;align-items:stretch;overflow-x:auto;overflow-y:hidden;border-right:0;border-bottom:1px solid var(--bd);scroll-snap-type:x proximity;-webkit-overflow-scrolling:touch}
  .sidebar .sh{display:none}
  .nav-row{display:flex;align-items:center;border-bottom:0;border-right:1px solid var(--bd);position:sticky;left:0;background:var(--s1);z-index:1}
  .pt{flex:0 0 212px;border-bottom:0;border-right:1px solid var(--bd);scroll-snap-align:start}
  .pt.sel{box-shadow:inset 0 -3px 0 var(--acc)}
  .pt .adh{margin-top:4px}
  .augi-panel{position:fixed;top:48px;right:0;bottom:0;width:min(440px,100%);z-index:50;border-left:1px solid var(--bd);box-shadow:var(--sh3);transform:translateX(102%);visibility:hidden;transition:transform .24s var(--ease),visibility 0s linear .24s}
  .app.augi-open .augi-panel{transform:none;visibility:visible;transition:transform .24s var(--ease),visibility 0s}
  .app.augi-open .augi-scrim{display:block;position:fixed;inset:48px 0 0 0;background:rgba(15,23,42,.35);z-index:40;animation:ui-fade-in .16s var(--ease) both}
  .ap-close{display:inline-flex}
  .th-tiles{grid-template-columns:1fr}
}

/* Phone */
@media (max-width:639px){
  .topbar{gap:6px}
  .tb-brand{font-size:var(--fs-md);min-width:0;overflow:hidden;white-space:nowrap;text-overflow:ellipsis}
  .tb-live-text,.tb-date,.tb-sep,.tb-user{display:none}
  .tb-actions{gap:6px}
  .augi-panel{width:100%}
  .dash{padding:12px}
  .stat-row{gap:8px}
  .stat-num{font-size:var(--fs-xl)}
  .dash-grid{grid-template-columns:1fr}
  .pt-hero{padding:12px}
  .hero-actions{width:100%}.hero-actions>button{flex:1 1 150px}
  .alerts-strip,.wounds-sec{padding-left:12px;padding-right:12px}
  .cards{padding:10px 12px}
  .wound-actions{flex-wrap:wrap}
  .wound-card-hdr{flex-direction:column}
  .af-row{grid-template-columns:1fr}
  .ci-grid,.ci-mini-grid{grid-template-columns:repeat(2,1fr)}
  .bill-code-row{grid-template-columns:auto 1fr auto}.bill-code-desc{grid-column:1/-1}
  .audit-log-row{flex-direction:column;gap:2px}.audit-log-meta{text-align:left}
  .modal-backdrop{padding:0;align-items:flex-end}
  .modal-panel{max-height:94dvh;border-radius:16px 16px 0 0;padding:18px 16px calc(18px + env(safe-area-inset-bottom))}
  .th{padding:12px}
  .th-tile{min-height:200px}
  .th-controls{padding-bottom:calc(10px + env(safe-area-inset-bottom))}
  .inp-area{padding-bottom:calc(9px + env(safe-area-inset-bottom))}
  .augi-inp,.af-field input,.af-field select,.af-field textarea,.hitl-field textarea,.hitl-field input,.rv-turn textarea{font-size:16px} /* prevents iOS zoom on focus */
}

/* Touch devices: ≥44px targets for everything tappable */
@media (pointer:coarse){
  .pt,.nav-btn,.bill-tab,.wound-btn,.add-wound-btn,.qb,.bc-btn,.hitl-approve,.hitl-reject,.af-chip,.af-method-btn,.tb-signout,.tb-augi,.bill-launch-btn,.th-launch-btn,.th-assess-btn,.modal-close,.ap-close{min-height:44px}
  .modal-close,.ap-close{min-width:44px}
  .qb,.bc-btn{padding-left:12px;padding-right:12px}
  .th-ctrl-btn{width:52px;height:52px}
  .send-btn{width:44px;height:44px}
}
@media (hover:none){.dcard:hover{transform:none;box-shadow:var(--sh1);border-color:var(--bd)}}
`;

export const NAVY_CSS = `
/* Navy brand surfaces: top bar + assistant header carry the brand colour; content stays light for readability. */
.topbar{background:var(--navy);border-bottom:0;color:#fff;box-shadow:0 1px 0 rgba(255,255,255,.06)}
.tb-brand,.tb-prod{color:#fff}.tb-prod-sub{font-weight:500;color:rgba(255,255,255,.72)}.tb-div{background:rgba(255,255,255,.28)}
.tb-actions,.tb-live-text{color:rgba(255,255,255,.82)}
.tb-signout{color:#fff}.tb-signout:hover{background:rgba(255,255,255,.14);color:#fff}
.topbar .nf-bell{color:#fff}.topbar .nf-bell:hover,.topbar .nf-bell[aria-expanded=true]{background:rgba(255,255,255,.14);color:#fff}
.topbar .nf-badge{box-shadow:0 0 0 2px var(--navy)}
.ad .ad-top{background:var(--navy);border-bottom:0;color:#fff}.ad .ad-top .tb-brand,.ad .ad-top .tb-brand>span{color:#fff}.ad .ad-top .ad-btn{background:rgba(255,255,255,.12);border-color:rgba(255,255,255,.28);color:#fff}.ad .ad-top .ad-btn:hover{background:rgba(255,255,255,.22)}.ad .ad-top .ad-user{color:rgba(255,255,255,.88)}.ad .ad-top .pill{background:rgba(255,255,255,.14);border-color:rgba(255,255,255,.3);color:#fff}
.ap-hdr{background:var(--navy);border-bottom:0}.ap-hdr .pill{background:rgba(255,255,255,.14);color:#fff;border-color:rgba(255,255,255,.25)}.ap-hdr .pill.p-red{background:var(--red);border-color:var(--red)}.ap-name{color:#fff}.ap-sub{color:rgba(255,255,255,.72)}.ap-close{color:#fff}
.dash-title,.ct{color:var(--navy)}
.dash-section-lbl,.sb-lbl,.sh{color:var(--navy);font-weight:800}
.pt.sel,.pt.active{box-shadow:inset 3px 0 0 var(--navy)}
.nav-btn.navsel{background:var(--navy);color:#fff}.nav-btn.navsel *{color:#fff}
.ad-tab.on{color:var(--navy);border-bottom-color:var(--teal)}
`;
