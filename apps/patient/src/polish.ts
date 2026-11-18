// Selma (patient) polish layer — sits on top of @wc/shared/ui tokens.
// Hierarchy: one solid primary per screen (.big-cta / .ssend); everything else is outlined or ghost.
export const PATIENT_POLISH_CSS = `
body{background:var(--s3)}
.phone{min-height:100vh;min-height:100dvh}
@media (max-width:460px){.phone{box-shadow:none}}

/* readability */
.sbubble{font-size:14px;line-height:1.6;max-width:min(82%,65ch)}
.msg-text,.cp-label,.consent-card,.greet-banner div div{line-height:1.6}
.msg-text,.consent-card,.redflag-item{max-width:65ch}
.hcard-title,.msg-from,.redflag-title{font-size:11px}
.msg-ts,.unread-badge,.sdisc,.logout,.demo-switch,.pth-rec,.bnav-item,.sbubble.tool-chip{font-size:11px}
.sdisc{line-height:1.5}
.tool-chip{line-height:1.4}

/* hierarchy */
.big-cta{background:var(--acc);box-shadow:var(--sh1);transition:var(--t);min-height:46px}
.big-cta:hover{background:var(--acc-h);box-shadow:var(--sh2)}
.logout,.demo-switch{background:transparent;border-color:transparent;color:var(--tx3);transition:var(--t);min-height:32px}
.logout:hover{background:var(--s3);color:var(--tx)}
.ssend{transition:var(--t);box-shadow:var(--sh1)}
.ssend:hover:not(:disabled){filter:brightness(1.08);box-shadow:var(--sh2)}
.ssend:disabled{opacity:.45}
.quick-chip{transition:var(--t);color:var(--tx2);border-color:var(--bd)}
.quick-chip:hover{background:var(--s3);border-color:var(--bd2);color:var(--tx)}
.sbubble.user{background:var(--acc)}
.sbubble.tool-chip{color:var(--grn)}
.sbubble.tool-chip.alert{color:var(--red)}
.hcard,.cp-step,.msg-card{transition:var(--t)}
.cp-step:hover{border-color:var(--bd2);background:var(--s2)}
.cp-step:active{transform:translateY(1px)}
.msg-card.urgent{border-left:3px solid var(--red)}

/* nav */
.bnav{padding-bottom:env(safe-area-inset-bottom);box-shadow:0 -1px 0 var(--bd)}
.bnav-item{transition:var(--t);min-height:52px;justify-content:center;font-size:11px}
.bnav-item:hover{color:var(--tx);background:var(--s2)}
.bnav-item.sel{color:var(--acc)}
.bnav-item.sel::before{content:"";position:absolute;top:0;left:30%;right:30%;height:2px;background:var(--acc);border-radius:0 0 2px 2px}
.stopbar{padding-top:max(12px,env(safe-area-inset-top))}

/* typing indicator: soft fade, not bounce */
.typing-row .d{animation:dotfade 1.2s ease-in-out infinite}
.typing-row .d:nth-child(2){animation-delay:.2s}.typing-row .d:nth-child(3){animation-delay:.4s}
@keyframes dotfade{0%,100%{opacity:.25}50%{opacity:.9}}
.smsgs>*{animation:ui-fade-in .18s var(--ease) both}

/* viewport-safe heights (dvh so the iOS URL bar doesn't hide the composer) */
.schat{height:calc(100vh - 122px);height:calc(100dvh - 122px)}
.th-call{height:calc(100vh - 182px);height:calc(100dvh - 182px)}
.sinput-row{padding-bottom:max(10px,env(safe-area-inset-bottom))}
.sinput-row input{font-size:16px;min-height:44px}  /* 16px prevents iOS focus-zoom */
.pth-btn{width:52px;height:52px;transition:var(--t)}
.pth-btn:hover{background:var(--s3)}
.pth-btn.end:hover{background:var(--red-h)}

@media (pointer:coarse){
  .quick-chip{min-height:36px;display:inline-flex;align-items:center}
  .ssend{width:44px;height:44px}
}
@media (max-height:560px){.pth-tile{min-height:160px}.pth-avatar{width:56px;height:56px;font-size:20px}}
.stopbar{position:relative;z-index:70}
`;

export const PATIENT_NAVY_CSS = `
.stopbar{background:var(--navy);border-bottom:0}
.stopbar .logout{background:rgba(255,255,255,.12);border-color:rgba(255,255,255,.3);color:#fff}.stopbar .logout:hover{background:rgba(255,255,255,.22)}
.stopbar .nf-bell{color:#fff}.stopbar .nf-bell:hover,.stopbar .nf-bell[aria-expanded=true]{background:rgba(255,255,255,.14);color:#fff}.stopbar .nf-badge{box-shadow:0 0 0 2px var(--navy)}
.greet-banner{background:linear-gradient(135deg,var(--navy),var(--navy-2));border:0;color:#fff;box-shadow:0 4px 14px rgba(5,40,80,.18)}
.hcard-title{color:var(--navy)}
.bnav-item.sel{color:var(--navy)}.bnav-item.sel::before{background:var(--teal)}
.login-bg{background:linear-gradient(160deg,var(--navy) 0%,var(--navy-2) 100%)}
.login-bg .hcard{border:0;box-shadow:0 12px 40px rgba(0,0,0,.28)}
.pwr.flat{color:rgba(255,255,255,.78)}
`;
