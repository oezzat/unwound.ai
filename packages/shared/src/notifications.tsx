// @ts-nocheck
import { Ic } from "./icons";
import { useState, useEffect, useRef, useCallback } from "react";

// Notification bell + inbox + settings, shared by both apps.
//   • Inbox: GET /api/notifications. Refreshed on a live signal (SSE), every minute, and when the tab regains focus.
//   • Push: optional. Needs HTTPS, a service worker (/sw.js), the server's VAPID key, and the user's permission.
//     The push message itself is generic ("You have a new message"); details are read here, after sign-in.

export const NOTIF_CSS = `
.nf{position:relative;display:inline-flex}
.nf-bell{position:relative;display:inline-flex;align-items:center;justify-content:center;width:36px;height:36px;border-radius:50%;border:1px solid transparent;background:transparent;color:var(--tx2);font-size:17px;cursor:pointer;transition:var(--t)}
.nf-bell:hover{background:var(--s3);color:var(--tx)}
.nf-bell[aria-expanded=true]{background:var(--s3)}
.nf-badge{position:absolute;top:-2px;right:-2px;min-width:18px;height:18px;padding:0 5px;border-radius:9px;background:var(--red);color:#fff;font-size:11px;font-weight:700;line-height:18px;text-align:center;box-shadow:0 0 0 2px var(--s1)}
.nf-panel{position:absolute;top:calc(100% + 8px);right:0;z-index:80;width:380px;max-width:calc(100vw - 16px);max-height:min(560px,calc(100dvh - 90px));display:flex;flex-direction:column;background:var(--s1);border:1px solid var(--bd);border-radius:var(--r-lg);box-shadow:var(--sh3);overflow:hidden;animation:ui-fade-in .16s var(--ease) both;text-align:left}
.nf-hd{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:11px 14px;border-bottom:1px solid var(--bd)}
.nf-hd b{font-size:14px}
.nf-link{background:none;border:none;color:var(--acc);font-size:12px;font-weight:600;cursor:pointer;padding:4px 2px;transition:var(--t)}
.nf-link:hover{color:var(--acc-h);text-decoration:underline}
.nf-link:disabled{color:var(--tx3);cursor:default;text-decoration:none}
.nf-list{overflow-y:auto;flex:1;min-height:80px}
.nf-item{display:flex;gap:10px;width:100%;text-align:left;padding:11px 14px;border:none;border-bottom:1px solid var(--bd);background:var(--s1);cursor:pointer;transition:var(--t);color:var(--tx)}
.nf-item:hover{background:var(--s2)}
.nf-item.unread{background:rgba(8,94,196,.05)}
.nf-item.unread:hover{background:rgba(8,94,196,.09)}
.nf-dot{flex:0 0 8px;height:8px;border-radius:50%;margin-top:6px;background:transparent}
.nf-item.unread .nf-dot{background:var(--acc)}
.nf-item.urgent.unread .nf-dot{background:var(--red)}
.nf-t{font-size:13px;font-weight:600;line-height:1.4}
.nf-b{font-size:12px;color:var(--tx2);line-height:1.55;margin-top:2px;max-width:65ch;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}
.nf-ts{font-size:11px;color:var(--tx3);margin-top:3px}
.nf-empty{padding:28px 18px;text-align:center;color:var(--tx2);font-size:13px;line-height:1.6}
.nf-set{border-top:1px solid var(--bd);padding:10px 14px;background:var(--s2);font-size:12px;overflow-y:auto;max-height:46%}
.nf-set h4{font-size:11px;letter-spacing:.05em;text-transform:uppercase;color:var(--tx3);margin:6px 0}
.nf-row{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:5px 0;line-height:1.4}
.nf-row input[type=checkbox]{width:16px;height:16px;accent-color:var(--acc)}
.nf-note{font-size:12px;color:var(--tx2);line-height:1.55;margin:4px 0 8px;max-width:65ch}
.nf-btn{font-size:12px;font-weight:700;border-radius:var(--r-sm);padding:7px 12px;min-height:32px;border:1px solid var(--bd2);background:var(--s1);color:var(--tx);cursor:pointer;transition:var(--t)}
.nf-btn:hover{background:var(--s3)}
.nf-btn.pri{background:var(--acc);border-color:var(--acc);color:#fff}
.nf-btn.pri:hover{background:var(--acc-h)}
.nf-err{color:var(--red);font-size:12px;margin:4px 0}
@media (max-width:640px){.nf-panel{position:fixed;top:56px;left:8px;right:8px;width:auto;max-width:none}.nf-bell{width:40px;height:40px}}
`;

const b64ToU8 = (s) => { const p = "=".repeat((4 - (s.length % 4)) % 4); const r = atob((s + p).replace(/-/g, "+").replace(/_/g, "/")); return Uint8Array.from([...r].map(c => c.charCodeAt(0))); };
const supported = () => typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent);
const standalone = () => window.matchMedia?.("(display-mode: standalone)").matches || navigator.standalone === true;

async function currentSub() {
  if (!supported()) return null;
  const reg = await navigator.serviceWorker.getRegistration("/");
  return reg ? reg.pushManager.getSubscription() : null;
}

/** Call on sign-out (and when a session expires): removes this device's push subscription so the next person on a shared device isn't sent someone else's alerts. */
export async function disablePush(api) {
  try {
    const sub = await currentSub();
    if (!sub) return;
    await api?.req("/api/push/unsubscribe", { endpoint: sub.endpoint }).catch(() => {});
    await sub.unsubscribe();
  } catch { /* best effort */ }
}

const ago = (ts) => { const s = Math.max(1, Math.round((Date.now() - ts) / 1000)); if (s < 60) return "just now"; const m = Math.round(s / 60); if (m < 60) return `${m} min ago`; const h = Math.round(m / 60); if (h < 24) return `${h} h ago`; return new Date(ts).toLocaleDateString("en-US", { month: "short", day: "numeric" }); };

export function NotificationBell({ api, subscribe, onOpen, audience }) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState({ items: [], unread: 0 });
  const [settings, setSettings] = useState(false);
  const [prefs, setPrefs] = useState(null);
  const [push, setPush] = useState({ state: "checking", publicKey: null });   // checking | unavailable | unsupported | ios-install | off | on | blocked
  const [err, setErr] = useState(""); const [busy, setBusy] = useState(false);
  const root = useRef(null);

  const load = useCallback(() => { api.req("/api/notifications?limit=30").then(setData, () => {}); }, [api]);
  useEffect(() => {
    load();
    const t = setInterval(load, 60_000);
    const onVis = () => { if (document.visibilityState === "visible") load(); };
    document.addEventListener("visibilitychange", onVis); window.addEventListener("focus", load);
    const un = subscribe?.(load);
    return () => { clearInterval(t); document.removeEventListener("visibilitychange", onVis); window.removeEventListener("focus", load); un?.(); };
  }, [load, subscribe]);

  // keep the server's idea of "today" and "9 am" in the user's own time zone
  useEffect(() => { api.req("/api/notifications/prefs").then(p => { setPrefs(p); const tz = Intl.DateTimeFormat().resolvedOptions().timeZone; if (tz && tz !== p.tz) api.req("/api/notifications/prefs", { tz }).catch(() => {}); }, () => {}); }, [api]);
  useEffect(() => {
    (async () => {
      try {
        const cfg = await api.req("/api/push/config");
        if (!cfg.enabled) return setPush({ state: "unavailable" });
        if (!supported()) return setPush({ state: isIOS() && !standalone() ? "ios-install" : "unsupported" });
        if (Notification.permission === "denied") return setPush({ state: "blocked", publicKey: cfg.publicKey });
        setPush({ state: (await currentSub()) ? "on" : "off", publicKey: cfg.publicKey });
      } catch { setPush({ state: "unavailable" }); }
    })();
  }, [api]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e) => { if (root.current && !root.current.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDoc); document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDoc); document.removeEventListener("keydown", onKey); };
  }, [open]);

  const markAll = async () => { setData(d => ({ items: d.items.map(i => ({ ...i, read: true })), unread: 0 })); await api.req("/api/notifications/read", { all: true }).catch(() => {}); };
  const openItem = async (it) => {
    if (!it.read) { setData(d => ({ items: d.items.map(i => i.id === it.id ? { ...i, read: true } : i), unread: Math.max(0, d.unread - 1) })); api.req("/api/notifications/read", { ids: [it.id] }).catch(() => {}); }
    setOpen(false); onOpen?.(it);
  };
  const savePrefs = async (patch) => { setPrefs(p => ({ ...p, ...patch })); await api.req("/api/notifications/prefs", patch).catch(() => setErr("Couldn't save that setting.")); };
  const toggleKind = (k) => { const muted = new Set(prefs.mutedKinds); muted.has(k) ? muted.delete(k) : muted.add(k); savePrefs({ mutedKinds: [...muted] }); };

  const enablePush = async () => {
    setBusy(true); setErr("");
    try {
      const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
      await navigator.serviceWorker.ready;
      if ((await Notification.requestPermission()) !== "granted") { setPush(p => ({ ...p, state: Notification.permission === "denied" ? "blocked" : "off" })); return; }
      const sub = (await reg.pushManager.getSubscription()) || await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToU8(push.publicKey) });
      await api.req("/api/push/subscribe", sub.toJSON());
      setPush(p => ({ ...p, state: "on" }));
    } catch (e) { setErr(e?.message || "Couldn't turn on push notifications."); } finally { setBusy(false); }
  };
  const disable = async () => { setBusy(true); await disablePush(api); setPush(p => ({ ...p, state: "off" })); setBusy(false); };

  const pushUi = () => {
    switch (push.state) {
      case "on": return <div className="nf-row"><span>Push notifications are <b>on</b> for this device.</span><button className="nf-btn" disabled={busy} onClick={disable}>Turn off</button></div>;
      case "off": return <div><div className="nf-note">Get a short alert on this device when something needs you, even when the app is closed. It never shows patient details.</div><button className="nf-btn pri" disabled={busy} onClick={enablePush}>{busy ? "Turning on…" : "Turn on push notifications"}</button></div>;
      case "blocked": return <div className="nf-note">Notifications are blocked for this site in your browser settings. Allow them there, then come back.</div>;
      case "ios-install": return <div className="nf-note">On iPhone and iPad, push notifications work after you add this app to your Home Screen (Share → Add to Home Screen) and open it from there.</div>;
      case "unsupported": return <div className="nf-note">This browser doesn't support push notifications. You'll still see everything here in the app.</div>;
      case "unavailable": return <div className="nf-note">Push notifications aren't set up on this server yet. You'll still see everything here in the app.</div>;
      default: return null;
    }
  };

  return (
    <div className="nf" ref={root}>
      <button className="nf-bell" onClick={() => { setOpen(o => !o); if (!open) load(); }} aria-haspopup="dialog" aria-expanded={open} aria-label={`Notifications${data.unread ? `, ${data.unread} unread` : ""}`} title="Notifications">
        <Ic n="bell" size="1.25em"/>{data.unread > 0 && <span className="nf-badge" aria-hidden>{data.unread > 99 ? "99+" : data.unread}</span>}
      </button>
      {open && (
        <div className="nf-panel" role="dialog" aria-label="Notifications">
          <div className="nf-hd"><b>Notifications</b>
            <span><button className="nf-link" disabled={!data.unread} onClick={markAll}>Mark all read</button> · <button className="nf-link" onClick={() => setSettings(s => !s)} aria-expanded={settings}>{settings ? "Done" : "Settings"}</button></span></div>
          <div className="nf-list" role="list">
            {data.items.length === 0 ? <div className="nf-empty"><b style={{ color: "var(--tx)" }}>You're all caught up</b><br/>{audience === "patient" ? "Messages and reminders from your care team will show up here." : "Alerts, approvals and treatment suggestions will show up here."}</div>
              : data.items.map(it => (
                <button key={it.id} role="listitem" className={`nf-item ${it.read ? "" : "unread"} ${it.urgent ? "urgent" : ""}`} onClick={() => openItem(it)}>
                  <span className="nf-dot" aria-hidden/>
                  <span><div className="nf-t">{it.read ? "" : <span className="sr-only" style={{ position: "absolute", left: -9999 }}>Unread: </span>}{it.title}</div>{it.body && <div className="nf-b">{it.body}</div>}<div className="nf-ts">{ago(it.ts)}</div></span>
                </button>))}
          </div>
          {settings && (
            <div className="nf-set">
              {err && <div className="nf-err" role="alert">{err}</div>}
              <h4>On this device</h4>{pushUi()}
              {prefs && <><h4>Tell me about</h4>
                {prefs.kinds.map(k => <label key={k.kind} className="nf-row"><span>{k.label}</span><input type="checkbox" checked={!prefs.mutedKinds.includes(k.kind)} onChange={() => toggleKind(k.kind)}/></label>)}
                {audience === "patient" && <label className="nf-row"><span>Daily reminder time</span>
                  <select className="nf-btn" value={prefs.reminderHour} onChange={e => savePrefs({ reminderHour: Number(e.target.value) })}>{Array.from({ length: 16 }, (_, i) => i + 6).map(h => <option key={h} value={h}>{h === 12 ? "12 pm" : h > 12 ? `${h - 12} pm` : `${h} am`}</option>)}</select></label>}</>}
            </div>)}
        </div>)}
    </div>
  );
}
