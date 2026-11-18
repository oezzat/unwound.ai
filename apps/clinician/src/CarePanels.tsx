// @ts-nocheck
import { useState, useEffect, useRef, useCallback } from "react";
import { Ic } from "@wc/shared/icons";
import { preparePhoto, loadImageUrl } from "@wc/shared/photo";
import { api } from "./api";

// Three panels on the patient chart: treatment ladder (decision support), care pathway, wound photo timeline.
// All data is fetched per patient through the access-checked API; `version` changes whenever the chart is refreshed by an event.

export const CARE_CSS = `
.pill.p-org{color:var(--org);background:rgba(165,67,0,.1);border-color:rgba(165,67,0,.3)}
.cp-sec{flex-shrink:0;margin:0 20px 14px;background:var(--s1);border:1px solid var(--bd);border-radius:var(--r-lg);overflow:hidden}
.cp-hdr{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:11px 14px;border-bottom:1px solid var(--bd);flex-wrap:wrap}
.cp-ttl{font-size:var(--fs-sm);font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:var(--tx2)}
.cp-body{padding:12px 14px}
.cp-note{font-size:var(--fs-sm);color:var(--tx2);line-height:1.6;max-width:65ch}
.cp-muted{color:var(--tx3);font-size:var(--fs-xs)}
.cp-link{background:none;border:none;color:var(--acc);font-size:var(--fs-sm);font-weight:600;cursor:pointer;padding:4px 2px;transition:var(--t)}
.cp-link:hover{color:var(--acc-h);text-decoration:underline}
.cp-btn{font-size:var(--fs-sm);font-weight:600;border-radius:var(--r-sm);padding:6px 12px;border:1px solid var(--bd2);background:var(--s1);color:var(--tx2);cursor:pointer;transition:var(--t)}
.cp-btn:hover:not(:disabled){background:var(--s3);color:var(--tx)}
.cp-btn:disabled{opacity:.5}
.cp-btn.pri{background:var(--grn);border-color:var(--grn);color:#fff;box-shadow:var(--sh1)}
.cp-btn.pri:hover:not(:disabled){background:var(--grn-h);color:#fff}
.cp-btn.ghost{border-color:transparent;background:transparent;color:var(--tx3)}
.cp-btn.ghost:hover:not(:disabled){background:var(--s3)}
.cp-field{font-size:var(--fs-sm);padding:6px 9px;border:1px solid var(--bd2);border-radius:var(--r-sm);background:var(--s1);color:var(--tx);transition:var(--t)}
.lad{border:1px solid var(--bd);border-left:3px solid var(--org);border-radius:var(--r);padding:12px 14px;margin-bottom:10px;background:var(--s1)}
.lad-t{font-size:var(--fs-md);font-weight:700;margin-bottom:6px}
.lad-ev{display:grid;grid-template-columns:max-content 1fr;gap:2px 12px;font-size:var(--fs-sm);margin:6px 0 10px}
.lad-ev dt{color:var(--tx3)}.lad-ev dd{color:var(--tx)}
.lad-caution{background:rgba(188,31,42,.08);border:1px solid rgba(188,31,42,.3);color:var(--red);border-radius:var(--r-sm);padding:7px 10px;font-size:var(--fs-sm);line-height:1.5;margin:8px 0;max-width:65ch}
.lad textarea{width:100%;min-height:58px;resize:vertical;font:inherit;font-size:var(--fs-sm);line-height:1.5;padding:8px 10px;border:1px solid var(--bd2);border-radius:var(--r-sm);background:var(--s2)}
.lad-src{display:flex;gap:6px;flex-wrap:wrap;margin:8px 0 2px;align-items:center}
.lad-chip{font-size:var(--fs-xs);background:var(--s3);border:1px solid var(--bd);border-radius:10px;padding:1px 8px;color:var(--tx2)}
.lad-act{display:flex;gap:8px;margin-top:10px;flex-wrap:wrap;align-items:center}
.lad-done{font-size:var(--fs-sm);color:var(--tx2);padding:4px 0;border-bottom:1px solid var(--bd)}
.cp-prog{height:6px;border-radius:3px;background:var(--s4);overflow:hidden;margin:6px 0 10px}
.cp-prog>div{height:100%;background:var(--grn);transition:width .3s var(--ease)}
.cp-task{display:flex;gap:8px;align-items:flex-start;padding:6px 0;border-bottom:1px solid var(--bd);font-size:var(--fs-sm)}
.cp-task:last-child{border-bottom:none}
.cp-task .st{flex-shrink:0;width:16px;text-align:center}
.cp-task.over .tt{color:var(--red);font-weight:600}
.cp-task.done .tt{color:var(--tx3);text-decoration:line-through}
.ph-strip{display:flex;gap:10px;overflow-x:auto;padding-bottom:6px;-webkit-overflow-scrolling:touch;scroll-snap-type:x proximity}
.ph{flex:0 0 132px;scroll-snap-align:start;border:1px solid var(--bd);border-radius:var(--r);overflow:hidden;background:var(--s2);cursor:pointer;text-align:left;padding:0;transition:var(--t)}
.ph:hover{border-color:var(--bd2);box-shadow:var(--sh2);transform:translateY(-1px)}
.ph.sel{border-color:var(--acc);box-shadow:0 0 0 2px rgba(8,94,196,.25)}
.ph img,.ph .ph-ph{display:block;width:100%;height:96px;object-fit:cover;background:var(--s3)}
.ph .ph-ph{animation:ui-shimmer 1.6s linear infinite;background:linear-gradient(90deg,var(--s3) 25%,var(--s4) 37%,var(--s3) 63%);background-size:300% 100%}
.ph-meta{padding:6px 8px;font-size:var(--fs-xs);line-height:1.4;color:var(--tx2)}
.ph-meta b{color:var(--tx);font-size:var(--fs-sm)}
.ph-big{display:block;width:100%;max-height:60vh;object-fit:contain;background:#0d1117;border-radius:var(--r)}
.ph-cmp{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.ph-meas{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin:10px 0}
.ph-meas input{width:70px}
@media (max-width:640px){.cp-sec{margin:0 12px 12px}.ph-cmp{grid-template-columns:1fr}.lad-ev{grid-template-columns:1fr}.ph{flex-basis:116px}}
`;

const fmtDate = ts => new Date(ts).toLocaleDateString("en-US", { month: "short", day: "numeric" });
const useAsync = (fn, deps) => {
  const [state, set] = useState({ loading: true, data: null, error: null });
  const run = useCallback(() => { fn().then(data => set({ loading: false, data, error: null }), error => set(s => ({ loading: false, data: s.data, error: error?.message || "Failed" }))); }, deps);
  useEffect(() => { run(); }, [run]);
  return [state, run];
};
const Skeleton = () => <div aria-busy="true"><div className="skeleton skeleton-line w80"/><div className="skeleton skeleton-line w60"/></div>;

// ═══════════════════════════ Treatment ladder ═══════════════════════════
function Suggestion({ s, patientId, onChanged, onErr }) {
  const [action, setAction] = useState(s.action);
  const [dismissing, setDismissing] = useState(false);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const edited = action.trim() !== s.action;
  const go = async (p, body) => { setBusy(true); try { await api.req(`/api/patients/${patientId}/ladder/${s.id}/${p}`, body); onChanged(); } catch (e) { onErr(e.message); } finally { setBusy(false); } };
  const caution = s.evidence.find(e => /Caution/.test(e.label));
  return (
    <div className="lad fade-in">
      <div className="lad-t">{s.title}</div>
      <dl className="lad-ev">{s.evidence.filter(e => e !== caution).map((e, i) => <><dt key={"k" + i}>{e.label}</dt><dd key={"v" + i}>{e.value}</dd></>)}</dl>
      {caution && <div className="lad-caution" role="alert"><Ic n="warn"/> {caution.value}</div>}
      <label className="cp-muted" htmlFor={`la-${s.id}`}>Order text (edit before accepting if needed)</label>
      <textarea id={`la-${s.id}`} value={action} onChange={e => setAction(e.target.value)} maxLength={1500}/>
      <div className="lad-src"><span className="cp-muted">Basis:</span>{s.sources.map(x => <span key={x.cite} className="lad-chip">{x.cite}</span>)}<span className="cp-muted">· rule v{s.ruleVersion} · suggestion only, you decide</span></div>
      {dismissing ? (
        <div className="lad-act">
          <input className="cp-field" style={{ flex: 1, minWidth: 180 }} autoFocus placeholder="Why are you dismissing this? (required)" value={note} onChange={e => setNote(e.target.value)} maxLength={300}/>
          <button className="cp-btn" disabled={busy || note.trim().length < 3} onClick={() => go("dismiss", { note: note.trim() })}>Dismiss</button>
          <button className="cp-btn ghost" onClick={() => setDismissing(false)}>Back</button>
        </div>
      ) : (
        <div className="lad-act">
          <button className="cp-btn pri" disabled={busy || action.trim().length < 3} onClick={() => go("accept", { action: edited ? action.trim() : undefined })}><Ic n="check"/> Accept as order{edited ? " (edited)" : ""}</button>
          <button className="cp-btn ghost" disabled={busy} onClick={() => setDismissing(true)}>Dismiss…</button>
        </div>
      )}
    </div>
  );
}

function RulesModal({ onClose }) {
  const [{ loading, data }, reload] = useAsync(() => api.req("/api/ladder/rules"), []);
  const [err, setErr] = useState("");
  const [draftParams, setDraftParams] = useState({});
  const save = async (key, body) => { setErr(""); try { await api.req(`/api/ladder/rules/${key}`, body); setDraftParams(p => ({ ...p, [key]: undefined })); reload(); } catch (e) { setErr(e.message); } };
  return (
    <div className="modal-backdrop" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal-panel" style={{ maxWidth: 720 }} role="dialog" aria-label="Treatment ladder rules">
        <div className="modal-hdr"><div><div className="modal-title">Treatment ladder rules</div>
          <div className="modal-sub">Rules only fire for your organization after a clinician has reviewed and activated them. Changing a threshold returns the rule to draft.</div></div>
          <button className="modal-close" onClick={onClose} aria-label="Close"><Ic n="close"/></button></div>
        {err && <div className="lad-caution">{err}</div>}
        {loading ? <Skeleton/> : data.rules.map(r => (
          <div key={r.key} className="lad" style={{ borderLeftColor: r.status === "active" ? "var(--grn)" : "var(--bd2)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
              <div className="lad-t" style={{ marginBottom: 2 }}>{r.name} <span className="lad-chip">{r.status}</span></div>
              {r.status !== "unavailable" && (r.status === "active"
                ? <button className="cp-btn" onClick={() => save(r.key, { status: "disabled" })}>Disable</button>
                : <button className="cp-btn pri" onClick={() => save(r.key, { status: "active" })}>I have reviewed this rule: activate</button>)}
            </div>
            <div className="cp-note">{r.summary} <span className="cp-muted">Trigger: {r.trigger}.</span></div>
            {r.status === "unavailable" && <div className="cp-muted" style={{ marginTop: 4 }}>Not available yet. The app doesn't capture: {r.waitingOn.join(", ")}.</div>}
            {Object.entries(r.paramDefs).map(([k, d]) => (
              <div key={k} className="ph-meas" style={{ margin: "8px 0 0" }}>
                <label className="cp-muted" htmlFor={`${r.key}-${k}`}>{d.label}{d.unit ? ` (${d.unit})` : ""}</label>
                <input id={`${r.key}-${k}`} className="cp-field" type="number" min={d.min} max={d.max} step={d.step ?? 1} value={draftParams[r.key] ?? r.params[k]} onChange={e => setDraftParams(p => ({ ...p, [r.key]: e.target.value }))}/>
                {draftParams[r.key] !== undefined && <button className="cp-btn" onClick={() => save(r.key, { params: { [k]: Number(draftParams[r.key]) } })}>Save threshold</button>}
              </div>
            ))}
            <div className="lad-src"><span className="cp-muted">Sources (as listed in the roadmap, not independently verified):</span>{r.sources.map(x => <span key={x.cite} className="lad-chip">{x.cite}</span>)}</div>
            {r.reviewedBy && <div className="cp-muted">Last activated by {r.reviewedBy}, {new Date(r.reviewedAt).toLocaleString()}</div>}
          </div>
        ))}
      </div>
    </div>
  );
}

export function LadderPanel({ patientId, version }) {
  const [{ loading, data, error }, reload] = useAsync(() => api.req(`/api/patients/${patientId}/ladder`), [patientId, version]);
  const [rules, setRules] = useState(false);
  const [err, setErr] = useState("");
  return (
    <section className="cp-sec" aria-label="Treatment ladder">
      <div className="cp-hdr"><div className="cp-ttl"><Ic n="ladder"/> Treatment ladder · decision support</div><button className="cp-link" onClick={() => setRules(true)}>Review rules</button></div>
      <div className="cp-body">
        {err && <div className="lad-caution" role="alert">{err}</div>}
        {loading && !data ? <Skeleton/> : error && !data ? <div className="cp-note">Couldn't load suggestions: {error}</div> : (<>
          {data.metrics?.filter(m => m.pctReduction !== undefined).map(m => (
            <div key={m.woundId} className="cp-note" style={{ marginBottom: 8 }}>
              <b>{m.label}</b>: {m.firstArea} → {m.latestArea} cm² since {m.firstDate} (<b>{m.pctReduction}%</b> reduction{m.at4w != null ? ` · ${m.at4w}% at ~4 wk` : ""}{m.at8w != null ? ` · ${m.at8w}% at ~8 wk` : ""}), from {m.points} measurements
            </div>))}
          {data.open.length === 0 && <div className="cp-note">No open suggestions.{data.inactive.length > 0 && <> {data.inactive.length} rule{data.inactive.length === 1 ? " is" : "s are"} not yet activated for your organization. <button className="cp-link" onClick={() => setRules(true)}>Review and activate</button></>}</div>}
          {data.open.map(s => <Suggestion key={s.id} s={s} patientId={patientId} onChanged={() => { setErr(""); reload(); }} onErr={setErr}/>)}
          {data.notEvaluated.length > 0 && <details style={{ marginTop: 6 }}><summary className="cp-muted" style={{ cursor: "pointer" }}>{data.notEvaluated.length} active rule{data.notEvaluated.length === 1 ? "" : "s"} couldn't be evaluated (missing data)</summary>
            <ul className="cp-note" style={{ margin: "6px 0 0 18px" }}>{data.notEvaluated.map(n => <li key={n.rule}><b>{n.rule}</b>: needs {n.missing.join("; ")}</li>)}</ul></details>}
          {data.decided.length > 0 && <details style={{ marginTop: 6 }}><summary className="cp-muted" style={{ cursor: "pointer" }}>Recent decisions ({data.decided.length})</summary>
            {data.decided.map(d => <div key={d.id} className="lad-done"><b>{d.status === "accepted" ? <><Ic n="check"/> Accepted</> : <><Ic n="close"/> Dismissed</>}</b> · {d.title} <span className="cp-muted">· {d.decidedBy}{d.decisionNote ? ` · “${d.decisionNote}”` : ""}</span></div>)}</details>}
        </>)}
      </div>
      {rules && <RulesModal onClose={() => { setRules(false); reload(); }}/>}
    </section>
  );
}

// ═══════════════════════════ Pathway ═══════════════════════════
export function PathwayPanel({ patientId, version }) {
  const [{ loading, data }, reload] = useAsync(() => api.req(`/api/patients/${patientId}/pathways`), [patientId, version]);
  const [tpl, setTpl] = useState(null);
  useEffect(() => { api.req("/api/pathway-templates").then(r => setTpl(r.templates)).catch(() => {}); }, []);
  const [anchor, setAnchor] = useState(new Date().toLocaleDateString("en-CA"));
  const [key, setKey] = useState("");
  const [ending, setEnding] = useState(false);
  const [reason, setReason] = useState("");
  const [err, setErr] = useState("");
  const [showAll, setShowAll] = useState(false);
  const act = async (fn) => { setErr(""); try { await fn(); reload(); } catch (e) { setErr(e.message); } };
  const active = data?.pathways.find(p => p.status === "active");
  const today = data?.today;
  return (
    <section className="cp-sec" aria-label="Care pathway">
      <div className="cp-hdr"><div className="cp-ttl"><Ic n="calendar"/> Care pathway</div></div>
      <div className="cp-body">
        {err && <div className="lad-caution" role="alert">{err}</div>}
        {loading && !data ? <Skeleton/> : active ? (() => {
          const pend = active.tasks.filter(t => t.status === "pending");
          const due = pend.filter(t => t.due <= today).slice(0, 8);
          const upcoming = pend.filter(t => t.due > today).slice(0, 3);
          const shown = showAll ? active.tasks : [...due, ...upcoming];
          return (<>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
              <div><b style={{ fontSize: "var(--fs-md)" }}>{active.name}</b><div className="cp-muted">{active.anchorLabel} {active.anchorDate} · started by {active.enrolledBy}</div></div>
              {active.progress.overdue > 0 && <span className="pill p-red">{active.progress.overdue} overdue</span>}
            </div>
            <div className="cp-prog" role="progressbar" aria-valuenow={active.progress.done} aria-valuemax={active.progress.total} aria-label="Patient tasks completed"><div style={{ width: `${(active.progress.done / Math.max(1, active.progress.total)) * 100}%` }}/></div>
            <div className="cp-muted" style={{ marginBottom: 6 }}>{active.progress.done} of {active.progress.total} patient tasks done</div>
            {shown.map(t => (
              <div key={t.id} className={`cp-task ${t.status === "done" ? "done" : t.due < today && t.status === "pending" ? "over" : ""}`}>
                <span className="st" aria-hidden>{t.status === "done" ? <Ic n="check"/> : t.status === "skipped" ? "–" : t.due < today ? "!" : "○"}</span>
                <div style={{ flex: 1 }}><div className="tt">{t.title}</div><div className="cp-muted">{t.due === today ? "Today" : t.due}{t.audience === "clinician" ? " · for the care team" : ""}{t.kind === "photo" && t.photoId ? " · photo received" : ""}</div></div>
                {t.audience === "clinician" && t.status === "pending" && <button className="cp-btn" onClick={() => act(() => api.req(`/api/patients/${patientId}/pathway-tasks/${t.id}/done`, {}))}>Done</button>}
              </div>))}
            <div className="lad-act">
              <button className="cp-link" onClick={() => setShowAll(v => !v)}>{showAll ? "Show only what's due" : "Show full schedule"}</button>
              {ending ? (<>
                <input className="cp-field" style={{ flex: 1, minWidth: 160 }} autoFocus placeholder="Reason for ending (required)" value={reason} onChange={e => setReason(e.target.value)} maxLength={300}/>
                <button className="cp-btn" disabled={reason.trim().length < 3} onClick={() => act(() => api.req(`/api/patients/${patientId}/pathways/${active.id}/cancel`, { reason: reason.trim() }))}>End pathway</button>
                <button className="cp-btn ghost" onClick={() => setEnding(false)}>Back</button></>)
                : <button className="cp-btn ghost" onClick={() => setEnding(true)}>End pathway…</button>}
            </div>
          </>);
        })() : (<>
          <div className="cp-note" style={{ marginBottom: 10 }}>No active pathway. Enrol the patient to schedule daily photo check-ins, instructions and follow-up reminders.{data?.pathways.length > 0 && ` (${data.pathways.length} earlier pathway${data.pathways.length === 1 ? "" : "s"} ended.)`}</div>
          {tpl?.length > 0 && (<div className="ph-meas" style={{ margin: 0 }}>
            <select className="cp-field" aria-label="Pathway" value={key || tpl[0].key} onChange={e => setKey(e.target.value)}>{tpl.map(t => <option key={t.key} value={t.key}>{t.name}</option>)}</select>
            <label className="cp-muted" htmlFor="pw-anchor">{(tpl.find(t => t.key === (key || tpl[0].key)) || tpl[0]).anchorLabel}</label>
            <input id="pw-anchor" className="cp-field" type="date" style={{ width: 150 }} value={anchor} onChange={e => setAnchor(e.target.value)}/>
            <button className="cp-btn pri" onClick={() => act(() => api.req(`/api/patients/${patientId}/pathways`, { templateKey: key || tpl[0].key, anchorDate: anchor }))}>Start pathway</button>
          </div>)}
          {tpl?.length > 0 && <div className="cp-muted" style={{ marginTop: 8, maxWidth: "65ch" }}>{(tpl.find(t => t.key === (key || tpl[0].key)) || tpl[0]).description}</div>}
        </>)}
      </div>
    </section>
  );
}

// ═══════════════════════════ Photo timeline ═══════════════════════════
const PhotoImg = ({ patientId, id, big, alt }) => {
  const [url, setUrl] = useState(null); const [bad, setBad] = useState(false);
  useEffect(() => { let on = true; setUrl(null); setBad(false); loadImageUrl(p => api.blob(p), `/api/patients/${patientId}/photos/${id}/image`).then(u => on && setUrl(u), () => on && setBad(true)); return () => { on = false; }; }, [patientId, id]);
  if (bad) return <div className={big ? "ph-big" : "ph-ph"} style={{ display: "grid", placeItems: "center", color: "var(--tx3)", fontSize: 11 }}>Couldn't load</div>;
  return url ? <img className={big ? "ph-big" : undefined} src={url} alt={alt}/> : <div className={big ? "ph-big skeleton" : "ph-ph"} style={big ? { height: 260 } : undefined}/>;
};

function PhotoModal({ patientId, photo, photos, wounds, onClose, onChanged }) {
  const [cmp, setCmp] = useState("");
  const other = photos.find(p => p.id === cmp);
  const [L, setL] = useState(photo.lengthCm ?? ""); const [W, setW] = useState(photo.widthCm ?? ""); const [D, setD] = useState(photo.depthCm ?? "");
  const [err, setErr] = useState(""); const [busy, setBusy] = useState(false); const [retract, setRetract] = useState(false); const [reason, setReason] = useState("");
  const wound = wounds.find(w => w.id === photo.woundId);
  const area = L && W ? Math.round(Number(L) * Number(W) * 10) / 10 : null;
  const pct = other && area != null && other.areaCm2 ? Math.round(((other.areaCm2 - area) / other.areaCm2) * 100) : null;
  const run = async fn => { setBusy(true); setErr(""); try { await fn(); await onChanged(); } catch (e) { setErr(e.message); } finally { setBusy(false); } };
  return (
    <div className="modal-backdrop" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal-panel" style={{ maxWidth: other ? 920 : 640 }} role="dialog" aria-label="Wound photo">
        <div className="modal-hdr"><div><div className="modal-title">{wound ? `${wound.type} · ${wound.location}` : "Wound photo"}</div>
          <div className="modal-sub">{new Date(photo.takenAt).toLocaleString()} · sent by {photo.source === "patient" ? "the patient" : "the clinic"}{photo.note ? ` · “${photo.note}”` : ""}</div></div>
          <button className="modal-close" onClick={onClose} aria-label="Close"><Ic n="close"/></button></div>
        {err && <div className="lad-caution" role="alert">{err}</div>}
        <div className={other ? "ph-cmp" : undefined}>
          <div><PhotoImg patientId={patientId} id={photo.id} big alt={`Wound photo ${fmtDate(photo.takenAt)}`}/><div className="cp-muted" style={{ marginTop: 4 }}>{fmtDate(photo.takenAt)}{photo.areaCm2 != null ? ` · ${photo.areaCm2} cm²` : ""}</div></div>
          {other && <div><PhotoImg patientId={patientId} id={other.id} big alt={`Wound photo ${fmtDate(other.takenAt)}`}/><div className="cp-muted" style={{ marginTop: 4 }}>{fmtDate(other.takenAt)}{other.areaCm2 != null ? ` · ${other.areaCm2} cm²` : ""}{pct != null ? ` · ${pct >= 0 ? pct + "% smaller" : Math.abs(pct) + "% larger"} now` : ""}</div></div>}
        </div>
        <div className="ph-meas">
          <span className="cp-muted">Compare with</span>
          <select className="cp-field" aria-label="Compare with another photo" value={cmp} onChange={e => setCmp(e.target.value)}>
            <option value="">—</option>{photos.filter(p => p.id !== photo.id).map(p => <option key={p.id} value={p.id}>{fmtDate(p.takenAt)}{p.areaCm2 != null ? ` · ${p.areaCm2} cm²` : ""}</option>)}
          </select>
        </div>
        <div className="cp-muted" style={{ marginTop: 6 }}>Manual measurement (you measure on the patient or with a ruler in frame; the app does not analyze the image):</div>
        <div className="ph-meas">
          {[["Length", L, setL], ["Width", W, setW], ["Depth", D, setD]].map(([l, v, set]) => <label key={l} className="cp-muted">{l} cm <input className="cp-field" type="number" min="0" max="99" step="0.1" value={v} onChange={e => set(e.target.value)}/></label>)}
          <span className="cp-note">{area != null ? <>Area <b>{area} cm²</b></> : ""}</span>
          <button className="cp-btn pri" disabled={busy || !(Number(L) > 0 && Number(W) > 0)} onClick={() => run(() => api.req(`/api/patients/${patientId}/photos/${photo.id}/measure`, { lengthCm: Number(L), widthCm: Number(W), ...(D !== "" ? { depthCm: Number(D) } : {}) }))}>Save measurement</button>
        </div>
        {photo.measuredBy && <div className="cp-muted">Measured by {photo.measuredBy}, {new Date(photo.measuredAt).toLocaleString()}</div>}
        <div className="lad-act" style={{ marginTop: 14 }}>
          {retract ? (<>
            <input className="cp-field" style={{ flex: 1, minWidth: 160 }} autoFocus placeholder="Reason (required). The photo is hidden, not deleted." value={reason} onChange={e => setReason(e.target.value)} maxLength={300}/>
            <button className="cp-btn" disabled={busy || reason.trim().length < 3} onClick={() => run(async () => { await api.req(`/api/patients/${patientId}/photos/${photo.id}/retract`, { reason: reason.trim() }); onClose(); })}>Retract photo</button>
            <button className="cp-btn ghost" onClick={() => setRetract(false)}>Back</button></>)
            : <button className="cp-btn ghost" onClick={() => setRetract(true)}>Retract this photo…</button>}
        </div>
      </div>
    </div>
  );
}

export function PhotoPanel({ patientId, patient, version }) {
  const [{ loading, data }, reload] = useAsync(() => api.req(`/api/patients/${patientId}/photos`), [patientId, version]);
  const [open, setOpen] = useState(null);
  const [err, setErr] = useState(""); const [busy, setBusy] = useState(false);
  const [woundId, setWoundId] = useState("");
  const fileRef = useRef(null);
  const wounds = patient.wounds;
  const photos = data?.photos ?? [];
  const onFile = async e => {
    const f = e.target.files?.[0]; e.target.value = ""; if (!f) return;
    setBusy(true); setErr("");
    try { const p = await preparePhoto(f); await api.upload(`/api/patients/${patientId}/photos?woundId=${woundId || wounds[0]?.id || ""}`, p.blob); await reload(); }
    catch (x) { setErr(x.message || "Upload failed"); } finally { setBusy(false); }
  };
  const first = photos.filter(p => p.areaCm2 != null);
  return (
    <section className="cp-sec" aria-label="Wound photos">
      <div className="cp-hdr"><div className="cp-ttl"><Ic n="camera"/> Photo timeline · {photos.length}</div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {wounds.length > 1 && <select className="cp-field" aria-label="Wound for new photo" value={woundId} onChange={e => setWoundId(e.target.value)}>{wounds.map(w => <option key={w.id} value={w.id}>{w.type} · {w.location}</option>)}</select>}
          <input ref={fileRef} type="file" accept="image/*" capture="environment" hidden onChange={onFile}/>
          <button className="cp-btn" disabled={busy || wounds.length === 0} onClick={() => fileRef.current?.click()}>{busy ? "Uploading…" : "+ Add photo"}</button>
        </div></div>
      <div className="cp-body">
        {err && <div className="lad-caution" role="alert">{err}</div>}
        {loading && !data ? <div className="ph-strip"><div className="ph"><div className="ph-ph"/></div><div className="ph"><div className="ph-ph"/></div><div className="ph"><div className="ph-ph"/></div></div>
          : photos.length === 0 ? <div className="empty-state" style={{ padding: "18px 10px" }}><b>No photos yet</b><span className="cp-note">Photos sent by the patient from Selma, or added here, appear on this timeline. Compare any two and record manual measurements.</span></div>
          : <div className="ph-strip" role="list">{photos.map(p => {
            const w = wounds.find(x => x.id === p.woundId);
            return (<button key={p.id} role="listitem" className="ph" onClick={() => setOpen(p)} aria-label={`Photo from ${fmtDate(p.takenAt)}${p.areaCm2 != null ? `, ${p.areaCm2} square centimeters` : ", not measured"}`}>
              <PhotoImg patientId={patientId} id={p.id} alt=""/>
              <div className="ph-meta"><b>{fmtDate(p.takenAt)}</b> · {p.source === "patient" ? "Patient" : "Clinic"}<br/>{p.areaCm2 != null ? `${p.areaCm2} cm²` : <span className="cp-muted">not measured</span>}{wounds.length > 1 && w ? <><br/><span className="cp-muted">{w.location}</span></> : null}</div>
            </button>);
          })}</div>}
        {first.length >= 2 && <div className="cp-note" style={{ marginTop: 8 }}>Measured area: {first[0].areaCm2} cm² ({fmtDate(first[0].takenAt)}) → {first[first.length - 1].areaCm2} cm² ({fmtDate(first[first.length - 1].takenAt)})</div>}
      </div>
      {open && <PhotoModal patientId={patientId} photo={photos.find(p => p.id === open.id) || open} photos={photos} wounds={wounds} onClose={() => setOpen(null)} onChanged={reload}/>}
    </section>
  );
}

export function CarePanels({ patient }) {
  // any event that refreshes the chart (photo, pathway, ladder, assessment…) adds an audit entry: use that as the refresh signal
  const version = (patient.auditTrail || []).map(a => a.id).join("|").length + ":" + (patient.auditTrail?.[0]?.id || "");
  return (<>
    <LadderPanel patientId={patient.id} version={version}/>
    <PathwayPanel patientId={patient.id} version={version}/>
    <PhotoPanel patientId={patient.id} patient={patient} version={version}/>
  </>);
}
