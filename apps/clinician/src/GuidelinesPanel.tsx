// @ts-nocheck
import { useState, useEffect, useCallback } from "react";
import { api } from "./api";

const msg = e => e?.message || "Something went wrong";
const STATUS = { draft: "p-pur", active: "p-grn", retired: "" };

// Guideline library: upload → review in draft → activate. Only ACTIVE documents are searchable by Selma.
export default function GuidelinesPanel({ isSuper }) {
  const [state, setState] = useState({ loading: true, enabled: false, docs: [], max: 0 });
  const [err, setErr] = useState(""), [busy, setBusy] = useState(""), [adding, setAdding] = useState(false);
  const [f, setF] = useState({ title: "", publisher: "", version: "1", publishedOn: "", evidenceLevel: "", woundTypes: "", licenseNote: "" });
  const [file, setFile] = useState(null);
  const [q, setQ] = useState(""), [res, setRes] = useState(null);

  const load = useCallback(async () => {
    try {
      const st = await api.req("/api/guidelines/status");
      if (!st.enabled) return setState({ loading: false, enabled: false, docs: [], max: 0 });
      const { docs } = await api.req("/api/guidelines");
      setState({ loading: false, enabled: true, docs, max: st.maxBytes, model: st.embedModel });
    } catch (e) { setErr(msg(e)); setState(s => ({ ...s, loading: false })); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const upload = async e => {
    e.preventDefault(); setErr("");
    if (!file) return setErr("Choose a file first.");
    if (file.size > state.max) return setErr(`That file is larger than ${Math.round(state.max / 1048576)} MB.`);
    setBusy("upload");
    try {
      const qs = new URLSearchParams({ ...Object.fromEntries(Object.entries(f).filter(([, v]) => v)), filename: file.name });
      await api.upload("/api/guidelines?" + qs, file, "application/octet-stream");
      setAdding(false); setFile(null); setF({ title: "", publisher: "", version: "1", publishedOn: "", evidenceLevel: "", woundTypes: "", licenseNote: "" }); await load();
    } catch (ex) { setErr(msg(ex)); } finally { setBusy(""); }
  };
  const act = async (id, what) => {
    if (what === "retire" && !confirm("Retire this document? Selma will stop using it. It stays on file.")) return;
    setErr(""); setBusy(id);
    try { await api.req(`/api/guidelines/${id}/${what}`, {}); await load(); } catch (ex) { setErr(msg(ex)); } finally { setBusy(""); }
  };
  const test = async e => { e.preventDefault(); setErr(""); setBusy("search"); try { setRes((await api.req("/api/guidelines/search", { query: q })).passages); } catch (ex) { setErr(msg(ex)); } finally { setBusy(""); } };

  if (state.loading) return <div className="dash-sub">Loading…</div>;
  if (!state.enabled) return (<><div className="dash-title">Guideline library</div>
    <div className="card" style={{ marginTop: 12, lineHeight: 1.6, maxWidth: "65ch" }}>The guideline library isn't set up on this server yet. An administrator needs to set <code>GUIDELINES_DATABASE_URL</code> (and the embedding settings), then reload.</div></>);

  return (<>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
      <div><div className="dash-title">Guideline library</div>
        <div className="dash-sub" style={{ maxWidth: "65ch", lineHeight: 1.55 }}>{isSuper ? "Platform-wide guidelines every organisation's Selma can cite." : "Your organisation's own protocols. Platform guidelines are also available to Selma."} Uploads start as drafts; Selma only uses a document after you activate it.</div></div>
      <button className="ad-btn pri" onClick={() => setAdding(!adding)}>{adding ? "Cancel" : "+ Upload document"}</button>
    </div>
    {err && <div className="ad-err" role="alert">{err}</div>}
    {adding && <form className="card" style={{ margin: "12px 0" }} onSubmit={upload}>
      <div className="ad-form">
        <div className="af-field"><div className="af-label">File (PDF, DOCX, Markdown, text)</div><input type="file" accept=".pdf,.docx,.md,.txt" onChange={e => { const x = e.target.files?.[0] || null; setFile(x); if (x && !f.title) setF(v => ({ ...v, title: x.name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ") })); }}/></div>
        <div className="af-field"><div className="af-label">Title</div><input required minLength={3} value={f.title} onChange={e => setF({ ...f, title: e.target.value })}/></div>
        <div className="af-field"><div className="af-label">Publisher</div><input placeholder="e.g. IWGDF, NPIAP" value={f.publisher} onChange={e => setF({ ...f, publisher: e.target.value })}/></div>
        <div className="af-field"><div className="af-label">Version</div><input value={f.version} onChange={e => setF({ ...f, version: e.target.value })}/></div>
        <div className="af-field"><div className="af-label">Published (date or year)</div><input value={f.publishedOn} onChange={e => setF({ ...f, publishedOn: e.target.value })}/></div>
        <div className="af-field"><div className="af-label">Evidence level</div><input placeholder="e.g. Strong, Grade A" value={f.evidenceLevel} onChange={e => setF({ ...f, evidenceLevel: e.target.value })}/></div>
        <div className="af-field"><div className="af-label">Wound types (comma separated, blank = all)</div><input placeholder="dfu, pressure, venous, arterial, surgical" value={f.woundTypes} onChange={e => setF({ ...f, woundTypes: e.target.value })}/></div>
        <div className="af-field"><div className="af-label">License / permission note</div><input placeholder="Who gave permission to store this text" value={f.licenseNote} onChange={e => setF({ ...f, licenseNote: e.target.value })}/></div>
      </div>
      <div className="dash-sub" style={{ margin: "8px 0", maxWidth: "65ch", lineHeight: 1.55 }}>Uploading a new version of the same title replaces the old version once you activate it. Only upload text you are licensed to store. Scanned PDFs need OCR first.</div>
      <button className="ad-btn pri" disabled={busy === "upload"}>{busy === "upload" ? "Reading and indexing…" : "Upload as draft"}</button>
    </form>}
    <div className="card" style={{ margin: "12px 0", padding: 0, overflowX: "auto" }}>
      <table className="ad-table" style={{ width: "100%" }}>
        <thead><tr><th>Document</th><th>Scope</th><th>Version</th><th>Status</th><th>Size</th><th/></tr></thead>
        <tbody>
          {state.docs.length === 0 && <tr><td colSpan={6} style={{ padding: 20, color: "var(--tx2)" }}>No documents yet. Upload your first guideline.</td></tr>}
          {state.docs.map(d => (
            <tr key={d.id}>
              <td><b>{d.title}</b><div className="dash-sub">{[d.publisher, d.publishedOn, d.woundTypes?.length ? d.woundTypes.join(", ") : "all wound types"].filter(Boolean).join(" · ")}</div></td>
              <td>{d.scope === "platform" ? "Platform" : "Your org"}</td>
              <td>{d.version}</td>
              <td><span className={`pill ${STATUS[d.status]}`}>{d.status}</span>{d.status === "active" && d.activatedBy && <div className="dash-sub">activated {new Date(d.activatedAt).toLocaleDateString()}</div>}</td>
              <td>{d.pages} p · {d.chunks} chunks</td>
              <td style={{ whiteSpace: "nowrap" }}>
                {(isSuper ? d.scope === "platform" : d.scope === "org") && <>
                  {d.status === "draft" && <button className="ad-btn pri" disabled={busy === d.id} onClick={() => act(d.id, "activate")}>Activate</button>}{" "}
                  {d.status !== "retired" && <button className="ad-btn" disabled={busy === d.id} onClick={() => act(d.id, "retire")}>Retire</button>}</>}
              </td>
            </tr>))}
        </tbody>
      </table>
    </div>
    <div className="card" style={{ marginTop: 12 }}>
      <div className="af-label">Try a search — see what Selma would retrieve</div>
      <form onSubmit={test} style={{ display: "flex", gap: 8, margin: "8px 0", flexWrap: "wrap" }}>
        <input style={{ flex: 1, minWidth: 200 }} value={q} onChange={e => setQ(e.target.value)} placeholder="e.g. when should a diabetic foot ulcer be referred to vascular?"/>
        <button className="ad-btn" disabled={q.trim().length < 2 || busy === "search"}>Search</button>
      </form>
      {res && (res.length === 0 ? <div className="dash-sub">No matching passages in active documents.</div> : res.map((p, i) => (
        <div key={i} style={{ borderTop: "1px solid var(--bd)", padding: "10px 0" }}>
          <div style={{ fontSize: 12, fontWeight: 700 }}>{p.title} · v{p.version} · {p.pages}{p.section ? ` · ${p.section}` : ""}</div>
          <div style={{ fontSize: 13, lineHeight: 1.6, color: "var(--tx2)", maxWidth: "65ch" }}>{p.text.slice(0, 420)}{p.text.length > 420 ? "…" : ""}</div>
        </div>)))}
    </div>
  </>);
}
