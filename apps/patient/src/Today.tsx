// @ts-nocheck
import { useState, useEffect, useRef, useCallback } from "react";
import { Ic } from "@wc/shared/icons";
import { preparePhoto, loadImageUrl } from "@wc/shared/photo";
import { api } from "./api";

// "Today" card on Selma's Home: the patient's pathway tasks for today/overdue, and photo capture.
// Photos are taken with the camera input, re-encoded to JPEG on-device (location/EXIF removed) and sent over the API; nothing is kept on the phone.

export const TODAY_CSS = `
.td-task{display:flex;gap:10px;align-items:flex-start;padding:10px 0;border-bottom:1px solid var(--bd)}
.td-task:last-child{border-bottom:none}
.td-ic{width:22px;text-align:center;font-size:15px;flex-shrink:0;line-height:1.5}
.td-t{font-size:14px;font-weight:600;line-height:1.4}
.td-d{font-size:12px;color:var(--tx2);line-height:1.55;margin-top:2px;max-width:65ch}
.td-task.over .td-t{color:var(--red)}
.td-btn{flex-shrink:0;font-size:12px;font-weight:700;border-radius:var(--r);padding:8px 13px;min-height:36px;border:1px solid var(--bd2);background:var(--s1);color:var(--tx);cursor:pointer;transition:var(--t)}
.td-btn:hover{background:var(--s3)}
.td-btn.pri{background:var(--acc);border-color:var(--acc);color:#fff;box-shadow:var(--sh1)}
.td-btn.pri:hover{background:var(--acc-h)}
.td-btn:disabled{opacity:.5}
.td-prev{width:100%;max-height:46vh;object-fit:contain;border-radius:var(--r);background:#0d1117;display:block}
.td-note{width:100%;margin-top:10px;font:inherit;font-size:16px;padding:10px 12px;border:1px solid var(--bd2);border-radius:var(--r);background:var(--s2)}
.td-row{display:flex;gap:8px;margin-top:10px;flex-wrap:wrap}
.td-strip{display:flex;gap:8px;overflow-x:auto;padding:4px 0 2px}
.td-th{flex:0 0 76px;height:76px;border-radius:10px;object-fit:cover;background:var(--s3);border:1px solid var(--bd)}
.td-err{background:rgba(188,31,42,.08);border:1px solid rgba(188,31,42,.3);color:var(--red);border-radius:var(--r);padding:8px 10px;font-size:12px;line-height:1.5;margin-bottom:8px}
.td-ok{background:rgba(23,114,50,.08);border:1px solid rgba(23,114,50,.3);color:var(--grn);border-radius:var(--r);padding:8px 10px;font-size:12px;margin-bottom:8px}
.td-tip{font-size:12px;color:var(--tx2);line-height:1.55;margin:0 0 8px;max-width:65ch}
`;

const localDate = () => new Date().toLocaleDateString("en-CA"); // YYYY-MM-DD in the patient's own time zone

const Thumb = ({ id }) => {
  const [url, setUrl] = useState(null);
  useEffect(() => { let on = true; loadImageUrl(p => api.blob(p), `/api/me/photos/${id}/image`).then(u => on && setUrl(u), () => {}); return () => { on = false; }; }, [id]);
  return url ? <img className="td-th" src={url} alt="Your earlier wound photo"/> : <div className="td-th skeleton"/>;
};

function Capture({ taskId, onDone, onCancel }) {
  const [p, setP] = useState(null); const [note, setNote] = useState(""); const [busy, setBusy] = useState(false); const [err, setErr] = useState("");
  const ref = useRef(null);
  useEffect(() => { ref.current?.click(); }, []);       // open the camera straight away
  useEffect(() => () => { p && URL.revokeObjectURL(p.previewUrl); }, [p]);
  const pick = async e => { const f = e.target.files?.[0]; e.target.value = ""; if (!f) { if (!p) onCancel(); return; } setErr(""); try { setP(await preparePhoto(f)); } catch (x) { setErr(x.message); } };
  const send = async () => {
    setBusy(true); setErr("");
    try { await api.upload(`/api/me/photos?${new URLSearchParams({ ...(taskId ? { taskId } : {}), ...(note.trim() ? { note: note.trim() } : {}) })}`, p.blob); onDone(); }
    catch (x) { setErr(x.status === 413 ? "That photo is too large. Please try again." : x.message || "Couldn't send the photo. Check your connection and try again."); setBusy(false); }
  };
  return (<div>
    <input ref={ref} type="file" accept="image/*" capture="environment" hidden onChange={pick}/>
    {err && <div className="td-err" role="alert">{err}</div>}
    {!p ? <div className="td-tip">Opening your camera…<br/><button className="td-btn" onClick={() => ref.current?.click()}>Open camera</button> <button className="td-btn" onClick={onCancel}>Cancel</button></div> : (<>
      <img className="td-prev" src={p.previewUrl} alt="Preview of your wound photo"/>
      <div className="td-tip" style={{ marginTop: 8 }}>Is the wound in focus and well lit? Your care team will see this photo.</div>
      <input className="td-note" placeholder="Add a note (optional)" aria-label="Note for your care team" maxLength={500} value={note} onChange={e => setNote(e.target.value)}/>
      <div className="td-row"><button className="td-btn pri" disabled={busy} onClick={send}>{busy ? "Sending…" : "Send photo"}</button>
        <button className="td-btn" disabled={busy} onClick={() => { setP(null); ref.current?.click(); }}>Retake</button>
        <button className="td-btn" disabled={busy} onClick={onCancel}>Cancel</button></div></>)}
  </div>);
}

export default function Today({ patient, onStartCheckin }) {
  const [paths, setPaths] = useState(null); const [photos, setPhotos] = useState([]);
  const [capture, setCapture] = useState(null);   // null | { taskId? }
  const [ok, setOk] = useState(""); const [err, setErr] = useState("");
  const load = useCallback(() => {
    api.req(`/api/me/pathways?today=${localDate()}`).then(setPaths, () => {});
    api.req("/api/me/photos").then(r => setPhotos(r.photos), () => {});
  }, []);
  useEffect(() => { load(); }, [load, patient]);
  const active = paths?.pathways.find(p => p.status === "active");
  const today = paths?.today;
  const pend = active ? active.tasks.filter(t => t.status === "pending" && t.due <= today) : [];
  const upNext = active ? active.tasks.filter(t => t.status === "pending" && t.due > today)[0] : null;
  const tapDone = async t => { setErr(""); try { await api.req(`/api/me/pathway-tasks/${t.id}/done`, {}); load(); } catch (e) { setErr(e.message); } };
  const finished = () => { setCapture(null); setOk("Photo sent to your care team. Thank you!"); load(); setTimeout(() => setOk(""), 6000); };

  return (
    <div className="hcard fade-in">
      <div className="hcard-title">{active ? "Today" : "Photos"}</div>
      {ok && <div className="td-ok" role="status">{ok}</div>}
      {err && <div className="td-err" role="alert">{err}</div>}
      {capture ? <Capture taskId={capture.taskId} onDone={finished} onCancel={() => setCapture(null)}/> : (<>
        {active && pend.length === 0 && <div className="td-tip">You're all caught up for today. {upNext ? <>Next: <b>{upNext.title}</b> ({upNext.due}).</> : "Nice work."}</div>}
        {pend.slice(0, 5).map(t => {
          const over = t.due < today;
          return (
            <div key={t.id} className={`td-task ${over ? "over" : ""}`}>
              <div className="td-ic" aria-hidden>{t.kind === "photo" ? <Ic n="camera"/> : t.kind === "checkin" ? <Ic n="message"/> : t.kind === "visit" ? <Ic n="referral"/> : <Ic n="plan"/>}</div>
              <div style={{ flex: 1 }}><div className="td-t">{t.title}{over ? " · overdue" : ""}</div>{t.detail && <div className="td-d">{t.detail}</div>}</div>
              {t.kind === "photo" ? <button className="td-btn pri" onClick={() => setCapture({ taskId: t.id })}>Take photo</button>
                : t.kind === "checkin" ? <button className="td-btn pri" onClick={onStartCheckin}>Check in</button>
                : <button className="td-btn" onClick={() => tapDone(t)}>Got it</button>}
            </div>);
        })}
        {pend.length > 5 && <div className="td-tip" style={{ marginTop: 6 }}>+ {pend.length - 5} more earlier tasks</div>}
        {!active && <><div className="td-tip">Your care team can see photos you send. Take one in good light, about 12 inches (30 cm) from the wound.</div>
          <button className="td-btn" onClick={() => setCapture({})}><Ic n="camera"/> Send a wound photo</button></>}
        {photos.length > 0 && <><div className="hcard-title" style={{ marginTop: 14 }}>Your recent photos</div><div className="td-strip">{photos.slice(-6).reverse().map(p => <Thumb key={p.id} id={p.id}/>)}</div></>}
      </>)}
    </div>
  );
}
