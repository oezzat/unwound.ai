// ═══════════════════════════════════════════════════════════════════════════════
// Shared design foundation for both apps (Augi + Selma): tokens, reset, focus, motion, loading/empty states.
// App-specific layout/components live in each app; they only consume these tokens.
//
// Contrast (WCAG 2.2, computed): every text token is ≥ 4.5:1 on every surface (--s1…--s4, --bg), and every
// semantic colour is ≥ 5:1 on its own 12 % tint, so badges/alerts that put coloured text on a tint pass AA.
//   --tx 15.8:1 · --tx2 8.7:1 · --tx3 ≥ 4.96:1 (on --s4) · --acc 6.2 · --grn 6.0 · --red 6.2 · --yel/--org/--pur ≥ 5
// ═══════════════════════════════════════════════════════════════════════════════
export const UI_BASE_CSS = `
@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
:root{
  color-scheme:light;
  /* surfaces + borders */
  --bg:#f6f8fa;--s1:#ffffff;--s2:#f6f8fa;--s3:#eef1f4;--s4:#e3e8ee;
  --bd:#d0d7de;--bd2:#b8c1cb;
  /* text */
  --tx:#1f2328;--tx2:#444c56;--tx3:#59636e;
  /* semantic (text-safe on white and on their own tint) + hover shades */
  --acc:#085ec4;--navy:#052850;--navy-2:#0b3a6e;--teal:#00c4b8;--teal-d:#00766f;--grn:#177232;--red:#bc1f2a;--yel:#865a00;--org:#a54300;--pur:#7447c6;
  --acc-h:#064a9d;--grn-h:#115c27;--red-h:#9a1520;--pur-h:#5f37a8;
  /* type scale: nothing below 11px; body 13px at 1.6 */
  --fs-xs:11px;--fs-sm:12px;--fs-md:13px;--fs-lg:15px;--fs-xl:18px;--fs-2xl:22px;
  --lh:1.6;--lh-tight:1.3;--measure:65ch;
  /* shape + elevation */
  --r:8px;--r-sm:6px;--r-lg:12px;
  --sh1:0 1px 2px rgba(31,35,40,.05);
  --sh2:0 2px 8px rgba(31,35,40,.10);
  --sh3:0 12px 34px rgba(15,23,42,.24);
  /* motion: short, linear-ish easing, no overshoot */
  --ease:cubic-bezier(.2,0,0,1);
  --t:background-color .16s var(--ease),border-color .16s var(--ease),color .16s var(--ease),box-shadow .16s var(--ease),opacity .16s var(--ease),transform .12s var(--ease);
  --focus:0 0 0 3px rgba(8,94,196,.28);
}
html{-webkit-text-size-adjust:100%;text-size-adjust:100%}
body{background:var(--bg);color:var(--tx);font-family:'DM Sans',system-ui,-apple-system,'Segoe UI',sans-serif;font-size:var(--fs-md);line-height:var(--lh);-webkit-font-smoothing:antialiased;text-rendering:optimizeLegibility}
button,input,select,textarea{font:inherit;color:inherit}
button{cursor:pointer}
button:disabled,[aria-disabled=true]{cursor:not-allowed}
::selection{background:rgba(8,94,196,.18)}

/* Keyboard focus: always visible, never for mouse clicks */
:focus{outline:none}
:focus-visible{outline:2px solid var(--acc);outline-offset:2px}
input:focus-visible,select:focus-visible,textarea:focus-visible{outline:none;border-color:var(--acc)!important;box-shadow:var(--focus)}

/* Press feedback: a 1px settle, nothing bouncy */
button:active:not(:disabled),[role=button]:active{transform:translateY(1px)}

/* Readable measure for running text */
.measure{max-width:var(--measure)}

/* Loading + empty states */
@keyframes ui-shimmer{from{background-position:200% 0}to{background-position:-200% 0}}
.skeleton{display:block;border-radius:var(--r-sm);background:linear-gradient(90deg,var(--s3) 25%,var(--s4) 37%,var(--s3) 63%);background-size:300% 100%;animation:ui-shimmer 1.6s linear infinite;color:transparent;user-select:none}
.skeleton-line{height:12px;margin:8px 0}.skeleton-line.w60{width:60%}.skeleton-line.w80{width:80%}
.skeleton-card{height:96px;border-radius:var(--r)}
.empty-state{display:flex;flex-direction:column;align-items:center;gap:6px;text-align:center;padding:32px 20px;color:var(--tx2);font-size:var(--fs-md)}
.empty-state b{color:var(--tx);font-size:var(--fs-lg)}
@keyframes ui-fade-in{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:none}}
.fade-in{animation:ui-fade-in .2s var(--ease) both}

@media (prefers-contrast:more){:root{--bd:#8c959f;--bd2:#6e7781}}
@media (prefers-reduced-motion:reduce){
  *,*::before,*::after{animation-duration:.01ms!important;animation-iteration-count:1!important;transition-duration:.01ms!important;scroll-behavior:auto!important}
  .skeleton{animation:none}
}
`;
