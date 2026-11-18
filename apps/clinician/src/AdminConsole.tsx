// @ts-nocheck
import { useCallback, useEffect, useState } from "react";
import { Ic } from "@wc/shared/icons";
import { API_URL, api, session } from "./api";
import GuidelinesPanel from "./GuidelinesPanel";

// Administration console for the two non-clinical roles:
//   org_admin   → staff accounts, patient registry, clinician↔patient assignments, org activity log (no clinical data)
//   super_admin → organizations, cross-org aggregate analytics, pseudonymized dataset export, audited record access
const styles = `
.ad{height:100vh;height:100dvh;display:flex;flex-direction:column;overflow:hidden}
.ad-top{background:var(--s1);border-bottom:1px solid var(--bd);display:flex;align-items:center;justify-content:space-between;padding:0 16px;height:48px;flex-shrink:0;gap:10px}
.ad-tabs{display:flex;gap:4px;padding:8px 16px 0;border-bottom:1px solid var(--bd);background:var(--s1);flex-shrink:0;overflow-x:auto}
.ad-tab{padding:8px 12px;font-size:12px;font-weight:600;color:var(--tx2);cursor:pointer;border-bottom:2px solid transparent;white-space:nowrap;background:none;border-top:none;border-left:none;border-right:none;font-family:inherit}
.ad-tab.on{color:var(--acc);border-bottom-color:var(--acc)}
.ad-body{flex:1;overflow:auto;padding:16px;max-width:1180px;width:100%;margin:0 auto}
.ad table{width:100%;border-collapse:collapse;font-size:12px}
.ad th{position:sticky;top:0;background:var(--s1);white-space:nowrap;text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:var(--tx3);padding:6px 8px;border-bottom:1px solid var(--bd)}
.ad td{padding:8px;border-bottom:1px solid var(--bd);vertical-align:top}
.ad-btn{transition:var(--t);font-size:12px;font-weight:600;border:1px solid var(--bd2);background:var(--s1);color:var(--tx2);border-radius:7px;padding:5px 10px;cursor:pointer;font-family:inherit}
.ad-btn:hover{background:var(--s3)}.ad-btn.pri{background:var(--acc);border-color:var(--acc);color:#fff;box-shadow:var(--sh1)}.ad-btn.pri:hover{background:var(--acc-h)}.ad-btn.dng{color:var(--red);border-color:rgba(188,31,42,.4)}
.ad-btn:disabled{opacity:.5}
.ad-chip{display:inline-block;font-size:11px;background:var(--s3);border:1px solid var(--bd);border-radius:10px;padding:1px 7px;margin:0 4px 3px 0}
.ad-grid{display:grid;gap:10px;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));margin-bottom:14px}
.ad-stat .n{font-size:22px;font-weight:700}.ad-stat .l{font-size:11px;color:var(--tx3);text-transform:uppercase;letter-spacing:.05em}
.ad-form{display:grid;gap:8px 12px;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));margin-bottom:10px}
.ad-note{font-size:11px;color:var(--tx2);margin:6px 0 12px}
.ad-err{color:var(--red);font-size:12px;margin:6px 0}.ad-ok{color:var(--grn);font-size:12px;margin:6px 0}
.ad-h{font-size:14px;font-weight:700;margin:16px 0 8px}

.ad-tab{transition:var(--t)}.ad-tab:hover{color:var(--tx);background:var(--s2)}
.ad td{line-height:1.5}.ad tbody tr{transition:background-color .16s var(--ease)}.ad tbody tr:hover{background:var(--s2)}
.ad-note{max-width:65ch;line-height:1.6}
.ad-scroll{overflow-x:auto;-webkit-overflow-scrolling:touch}
.ad-scroll table{min-width:620px}
.ad-scroll td:first-child,.ad-scroll th:first-child{position:sticky;left:0;background:var(--s1);z-index:1}
@media (max-width:640px){
  .ad-body{padding:12px}
  .ad-top{padding:0 12px}
  .ad-form{grid-template-columns:1fr}
  .ad-grid{grid-template-columns:repeat(2,1fr)}
  .ad input,.ad select{font-size:16px}
}
@media (pointer:coarse){.ad-btn,.ad-tab{min-height:40px}}
`;

const fmtTs = ts => new Date(ts).toLocaleString();
const msg = e => e?.message || "Something went wrong";

function useLoad(path, deps = []) {
  const [data, setData] = useState(null);
  const [err, setErr] = useState("");
  const reload = useCallback(() => { setErr(""); return api.req(path).then(setData).catch(e => setErr(msg(e))); }, [path]);
  useEffect(() => { reload(); }, [reload, ...deps]);
  return { data, err, reload };
}

async function download(path, filename) {
  const res = await fetch(API_URL + path, { headers: { authorization: `Bearer ${session.get()}` } });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "download failed");
  const url = URL.createObjectURL(await res.blob());
  const a = document.createElement("a"); a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
}

function Field({ label, children }) { return <div className="af-field" style={{ marginBottom: 0 }}><div className="af-label">{label}</div>{children}</div>; }

// ───────────────────────────── Org admin ─────────────────────────────────────
function OrgPatients() {
  const pts = useLoad("/api/org/patients"); const staff = useLoad("/api/org/users");
  const [adding, setAdding] = useState(false), [editing, setEditing] = useState(null), [sel, setSel] = useState([]);
  const [err, setErr] = useState(""), [ok, setOk] = useState("");
  const blank = { name: "", email: "", password: "", mrn: "", age: "", provider: "", woundType: "", location: "", clinicianIds: [] };
  const [f, setF] = useState(blank);
  const clinicians = (staff.data?.users || []).filter(u => u.role === "clinician" && u.active);
  const toggle = (arr, id) => arr.includes(id) ? arr.filter(x => x !== id) : [...arr, id];
  const create = async e => {
    e.preventDefault(); setErr(""); setOk("");
    try { await api.req("/api/org/patients", { ...f, age: f.age ? Number(f.age) : undefined, mrn: f.mrn || undefined, provider: f.provider || undefined, woundType: f.woundType || undefined, location: f.location || undefined }); setF(blank); setAdding(false); setOk("Patient created. Share the temporary password with them securely."); pts.reload(); }
    catch (ex) { setErr(msg(ex)); }
  };
  const saveAssign = async pid => { setErr(""); try { await api.req(`/api/org/patients/${pid}/assignments`, { clinicianIds: sel }, "PUT"); setEditing(null); pts.reload(); staff.reload(); } catch (ex) { setErr(msg(ex)); } };
  const loginToggle = async p => { setErr(""); try { await api.req(`/api/org/patients/${p.id}/login`, { active: !p.loginActive }, "PATCH"); pts.reload(); } catch (ex) { setErr(msg(ex)); } };
  return (<>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
      <div><div className="dash-title">Patients</div><div className="dash-sub">Registry only — clinicians see a patient's clinical record only if you assign them here.</div></div>
      <button className="ad-btn pri" onClick={() => setAdding(!adding)}>{adding ? "Cancel" : "+ Add patient"}</button>
    </div>
    {err && <div className="ad-err">{err}</div>}{ok && <div className="ad-ok">{ok}</div>}
    {adding && <form className="card" style={{ margin: "12px 0" }} onSubmit={create}>
      <div className="ad-form">
        <Field label="Full name"><input required value={f.name} onChange={e => setF({ ...f, name: e.target.value })}/></Field>
        <Field label="MRN"><input value={f.mrn} onChange={e => setF({ ...f, mrn: e.target.value })}/></Field>
        <Field label="Age"><input type="number" min="0" max="120" value={f.age} onChange={e => setF({ ...f, age: e.target.value })}/></Field>
        <Field label="Responsible provider"><input value={f.provider} onChange={e => setF({ ...f, provider: e.target.value })}/></Field>
        <Field label="Wound type"><input value={f.woundType} onChange={e => setF({ ...f, woundType: e.target.value })} placeholder="e.g. Diabetic Foot Ulcer (DFU)"/></Field>
        <Field label="Wound location"><input value={f.location} onChange={e => setF({ ...f, location: e.target.value })}/></Field>
        <Field label="Patient login email (Selma)"><input type="email" required value={f.email} onChange={e => setF({ ...f, email: e.target.value })}/></Field>
        <Field label="Temporary password (min 10)"><input type="text" required minLength={10} value={f.password} onChange={e => setF({ ...f, password: e.target.value })}/></Field>
      </div>
      <div className="af-label">Assign clinicians</div>
      <div style={{ marginBottom: 10 }}>{clinicians.length ? clinicians.map(c => <label key={c.id} className="ad-chip" style={{ cursor: "pointer" }}><input type="checkbox" checked={f.clinicianIds.includes(c.id)} onChange={() => setF({ ...f, clinicianIds: toggle(f.clinicianIds, c.id) })}/> {c.name}</label>) : <span className="ad-note">Add a clinician on the Staff tab first.</span>}</div>
      <button className="ad-btn pri" type="submit">Create patient</button>
    </form>}
    {pts.err && <div className="ad-err">{pts.err}</div>}
    <div className="card" style={{ marginTop: 12, padding: 0, overflow: "auto" }}>
      <div className="ad-scroll"><table><thead><tr><th>Patient</th><th>MRN</th><th>Assigned clinicians</th><th>Selma login</th><th></th></tr></thead><tbody>
        {(pts.data?.patients || []).map(p => <tr key={p.id}>
          <td><b>{p.name}</b><div style={{ fontSize: 10, color: "var(--tx3)" }}>{p.id}</div></td>
          <td>{p.mrn || "—"}</td>
          <td>{editing === p.id
            ? <div>{clinicians.map(c => <label key={c.id} className="ad-chip" style={{ cursor: "pointer" }}><input type="checkbox" checked={sel.includes(c.id)} onChange={() => setSel(toggle(sel, c.id))}/> {c.name}</label>)}
                <div style={{ marginTop: 4 }}><button className="ad-btn pri" onClick={() => saveAssign(p.id)}>Save</button> <button className="ad-btn" onClick={() => setEditing(null)}>Cancel</button></div></div>
            : p.clinicians.length ? p.clinicians.map(c => <span key={c.id} className="ad-chip">{c.name}</span>) : <span style={{ color: "var(--red)", fontSize: 11 }}>No clinician assigned — nobody can open this record</span>}</td>
          <td>{p.loginActive ? "Active" : <span style={{ color: "var(--red)" }}>Disabled</span>}</td>
          <td style={{ whiteSpace: "nowrap" }}>{editing !== p.id && <button className="ad-btn" onClick={() => { setEditing(p.id); setSel(p.clinicians.map(c => c.id)); }}>Assign</button>} <button className="ad-btn" onClick={() => loginToggle(p)}>{p.loginActive ? "Disable login" : "Enable login"}</button></td>
        </tr>)}
        {pts.data && !pts.data.patients.length && <tr><td colSpan="5" style={{ color: "var(--tx3)" }}>No patients yet.</td></tr>}
      </tbody></table></div>
    </div>
  </>);
}

function OrgStaff({ meId }) {
  const st = useLoad("/api/org/users");
  const [adding, setAdding] = useState(false), [err, setErr] = useState("");
  const [f, setF] = useState({ name: "", email: "", role: "clinician", password: "" });
  const act = async (id, body) => { setErr(""); try { await api.req(`/api/org/users/${id}`, body, "PATCH"); st.reload(); } catch (ex) { setErr(msg(ex)); } };
  const create = async e => { e.preventDefault(); setErr(""); try { await api.req("/api/org/users", f); setF({ name: "", email: "", role: "clinician", password: "" }); setAdding(false); st.reload(); } catch (ex) { setErr(msg(ex)); } };
  return (<>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
      <div><div className="dash-title">Staff</div><div className="dash-sub">Clinicians can only open patients assigned to them. Admins manage accounts but see no clinical data.</div></div>
      <button className="ad-btn pri" onClick={() => setAdding(!adding)}>{adding ? "Cancel" : "+ Add staff"}</button>
    </div>
    {err && <div className="ad-err">{err}</div>}
    {adding && <form className="card" style={{ margin: "12px 0" }} onSubmit={create}>
      <div className="ad-form">
        <Field label="Name"><input required value={f.name} onChange={e => setF({ ...f, name: e.target.value })}/></Field>
        <Field label="Email"><input type="email" required value={f.email} onChange={e => setF({ ...f, email: e.target.value })}/></Field>
        <Field label="Role"><select value={f.role} onChange={e => setF({ ...f, role: e.target.value })}><option value="clinician">Clinician</option><option value="org_admin">Organization admin</option></select></Field>
        <Field label="Temporary password (min 10)"><input type="text" required minLength={10} value={f.password} onChange={e => setF({ ...f, password: e.target.value })}/></Field>
      </div>
      <button className="ad-btn pri" type="submit">Create account</button>
    </form>}
    <div className="card" style={{ marginTop: 12, padding: 0, overflow: "auto" }}>
      <div className="ad-scroll"><table><thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Patients</th><th>Status</th><th></th></tr></thead><tbody>
        {(st.data?.users || []).map(u => <tr key={u.id}>
          <td><b>{u.name}</b></td><td>{u.email}</td><td>{u.role === "org_admin" ? "Org admin" : "Clinician"}</td><td>{u.patients ?? "—"}</td>
          <td>{u.active ? "Active" : <span style={{ color: "var(--red)" }}>Deactivated</span>}</td>
          <td style={{ whiteSpace: "nowrap" }}>
            {u.id !== meId && <button className={`ad-btn ${u.active ? "dng" : ""}`} onClick={() => act(u.id, { active: !u.active })}>{u.active ? "Deactivate" : "Reactivate"}</button>}{" "}
            <button className="ad-btn" onClick={() => { const pw = window.prompt("New temporary password (min 10 characters):"); if (pw) act(u.id, { password: pw }); }}>Reset password</button>
          </td>
        </tr>)}
      </tbody></table></div>
    </div>
  </>);
}

function ActivityLog({ path, showOrg }) {
  const lg = useLoad(path);
  return (<>
    <div className="dash-title">Administrative activity</div>
    <div className="dash-sub">{showOrg ? "Every administrative action and every platform access to patient records." : "Includes any time a platform administrator opened one of your patients' records, with the reason given."}</div>
    {lg.err && <div className="ad-err">{lg.err}</div>}
    <div className="card" style={{ marginTop: 12, padding: 0, overflow: "auto" }}>
      <div className="ad-scroll"><table><thead><tr><th>When</th><th>Who</th><th>Action</th><th>Patient</th><th>Reason / detail</th></tr></thead><tbody>
        {(lg.data?.log || []).map(l => <tr key={l.id}><td style={{ whiteSpace: "nowrap" }}>{fmtTs(l.ts)}</td><td>{l.actor}<div style={{ fontSize: 10, color: "var(--tx3)" }}>{l.actorRole}</div></td><td><b>{l.action}</b></td><td>{l.patientId || "—"}</td><td>{l.reason || l.detail || ""}</td></tr>)}
      </tbody></table></div>
    </div>
  </>);
}

// ───────────────────────────── Super admin ───────────────────────────────────
function Overview() {
  const [minCell, setMinCell] = useState(5);
  const sm = useLoad(`/api/admin/analytics/summary?minCell=${minCell}`, [minCell]);
  const [err, setErr] = useState("");
  const d = sm.data;
  const dl = async orgId => { setErr(""); try { await download(`/api/admin/export/dataset${orgId ? `?orgId=${orgId}` : ""}`, "wound-care-dataset.ndjson"); } catch (ex) { setErr(msg(ex)); } };
  return (<>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
      <div><div className="dash-title">Platform overview</div><div className="dash-sub">Aggregates across all organizations. No names, MRNs or free text.</div></div>
      <div><button className="ad-btn pri" onClick={() => dl()}><Ic n="download"/> Download pseudonymized dataset (all orgs)</button></div>
    </div>
    {(sm.err || err) && <div className="ad-err">{sm.err || err}</div>}
    {d && <>
      <div className="ad-grid" style={{ marginTop: 14 }}>
        {[["Organizations", d.totals.orgs], ["Patients", d.totals.patients], ["Clinicians", d.totals.clinicians], ["Assessments (30d)", d.totals.assessments30d], ["Open alerts", d.totals.openAlerts]].map(([l, n]) => <div key={l} className="card ad-stat"><div className="n">{n}</div><div className="l">{l}</div></div>)}
      </div>
      <div className="card" style={{ padding: 0, overflow: "auto" }}>
        <div className="ad-scroll"><table><thead><tr><th>Organization</th><th>Patients</th><th>Clinicians</th><th>Assess. 30d</th><th>Open alerts</th><th>Avg adherence</th><th>Healing (improving / worsening)</th><th>Billing P / A / R</th><th>Telehealth</th><th></th></tr></thead><tbody>
          {d.orgs.map(o => <tr key={o.id}>
            <td><b>{o.name}</b>{!o.active && <span style={{ color: "var(--red)" }}> · suspended</span>}</td><td>{o.patients}</td><td>{o.clinicians}</td><td>{o.assessments30d}</td><td>{o.openAlerts}</td><td>{o.avgAdherence ?? "—"}{o.avgAdherence != null && "%"}</td>
            <td>{o.healing ? `${o.healing.improving} / ${o.healing.worsening} of ${o.healing.woundsTracked} (avg PUSH Δ ${o.healing.avgPushChange})` : "—"}</td>
            <td>{o.billing.pending} / {o.billing.approved} / {o.billing.rejected}</td>
            <td>{o.telehealth.sessions} visits{o.telehealth.sessions ? ` · ${o.telehealth.consented} consented` : ""}</td>
            <td><button className="ad-btn" onClick={() => dl(o.id)}>Dataset</button></td>
          </tr>)}
        </tbody></table></div>
      </div>
      <div className="ad-h">Wound types <span style={{ fontWeight: 400, fontSize: 11, color: "var(--tx3)" }}>(groups smaller than <select value={minCell} onChange={e => setMinCell(Number(e.target.value))} style={{ fontSize: 11 }}>{[1, 3, 5, 10, 20].map(n => <option key={n} value={n}>{n}</option>)}</select> patients are hidden{d.woundTypes.suppressedTypes ? ` — ${d.woundTypes.suppressedTypes} hidden` : ""})</span></div>
      <div>{d.woundTypes.shown.map(t => <span key={t.type} className="ad-chip">{t.type}: <b>{t.patients}</b></span>)}{!d.woundTypes.shown.length && <span className="ad-note">Nothing to show at this threshold.</span>}</div>
      <div className="ad-note" style={{ marginTop: 14 }}>The dataset is <b>pseudonymized</b> (keyed-hash ids, 10-year age bands, day offsets instead of dates). It is not certified de-identified: handle it as sensitive and run any new use past your privacy officer. Each download is logged.</div>
    </>}
  </>);
}

function Orgs() {
  const og = useLoad("/api/admin/orgs");
  const [adding, setAdding] = useState(false), [err, setErr] = useState("");
  const blank = { name: "", adminName: "", adminEmail: "", adminPassword: "" }; const [f, setF] = useState(blank);
  const create = async e => { e.preventDefault(); setErr(""); try { await api.req("/api/admin/orgs", f); setF(blank); setAdding(false); og.reload(); } catch (ex) { setErr(msg(ex)); } };
  const [adminFor, setAdminFor] = useState(null), [af, setAf] = useState({ name: "", email: "", password: "" }), [ok, setOk] = useState("");
  const addAdmin = async e => { e.preventDefault(); setErr(""); setOk(""); try { await api.req(`/api/admin/orgs/${adminFor.id}/admins`, af); setOk(`Admin created for ${adminFor.name}. Share the temporary password securely.`); setAdminFor(null); setAf({ name: "", email: "", password: "" }); } catch (ex) { setErr(msg(ex)); } };
  const toggle = async o => { if (o.active && !window.confirm(`Suspend ${o.name}? Every user in it is signed out immediately and cannot sign in.`)) return; setErr(""); try { await api.req(`/api/admin/orgs/${o.id}`, { active: !o.active }, "PATCH"); og.reload(); } catch (ex) { setErr(msg(ex)); } };
  return (<>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
      <div><div className="dash-title">Organizations</div><div className="dash-sub">Each organization's patients and staff are isolated from every other organization.</div></div>
      <button className="ad-btn pri" onClick={() => setAdding(!adding)}>{adding ? "Cancel" : "+ New organization"}</button>
    </div>
    {err && <div className="ad-err">{err}</div>}{ok && <div className="ad-ok">{ok}</div>}
    {adminFor && <form className="card" style={{ margin: "12px 0" }} onSubmit={addAdmin}>
      <div className="af-label">New admin for {adminFor.name}</div>
      <div className="ad-form">
        <Field label="Name"><input required value={af.name} onChange={e => setAf({ ...af, name: e.target.value })}/></Field>
        <Field label="Email"><input type="email" required value={af.email} onChange={e => setAf({ ...af, email: e.target.value })}/></Field>
        <Field label="Temporary password (min 10)"><input type="text" required minLength={10} value={af.password} onChange={e => setAf({ ...af, password: e.target.value })}/></Field>
      </div>
      <button className="ad-btn pri" type="submit">Create admin</button> <button className="ad-btn" type="button" onClick={() => setAdminFor(null)}>Cancel</button>
    </form>}
    {adding && <form className="card" style={{ margin: "12px 0" }} onSubmit={create}>
      <div className="ad-form">
        <Field label="Organization name"><input required value={f.name} onChange={e => setF({ ...f, name: e.target.value })}/></Field>
        <Field label="First admin — name"><input required value={f.adminName} onChange={e => setF({ ...f, adminName: e.target.value })}/></Field>
        <Field label="First admin — email"><input type="email" required value={f.adminEmail} onChange={e => setF({ ...f, adminEmail: e.target.value })}/></Field>
        <Field label="Temporary password (min 10)"><input type="text" required minLength={10} value={f.adminPassword} onChange={e => setF({ ...f, adminPassword: e.target.value })}/></Field>
      </div>
      <button className="ad-btn pri" type="submit">Create organization</button>
    </form>}
    <div className="card" style={{ marginTop: 12, padding: 0, overflow: "auto" }}>
      <div className="ad-scroll"><table><thead><tr><th>Name</th><th>Patients</th><th>Clinicians</th><th>Status</th><th></th></tr></thead><tbody>
        {(og.data?.orgs || []).map(o => <tr key={o.id}><td><b>{o.name}</b><div style={{ fontSize: 10, color: "var(--tx3)" }}>{o.id}</div></td><td>{o.patients}</td><td>{o.clinicians}</td><td>{o.active ? "Active" : <span style={{ color: "var(--red)" }}>Suspended</span>}</td><td style={{ whiteSpace: "nowrap" }}><button className="ad-btn" onClick={() => setAdminFor(o)}>+ Admin</button> <button className={`ad-btn ${o.active ? "dng" : ""}`} onClick={() => toggle(o)}>{o.active ? "Suspend" : "Reactivate"}</button></td></tr>)}
      </tbody></table></div>
    </div>
  </>);
}

function Records() {
  const [q, setQ] = useState(""), [rows, setRows] = useState(null), [err, setErr] = useState("");
  const [target, setTarget] = useState(null), [reason, setReason] = useState(""), [rec, setRec] = useState(null);
  const search = async e => { e?.preventDefault(); setErr(""); try { setRows((await api.req(`/api/admin/patients?q=${encodeURIComponent(q)}`)).patients); } catch (ex) { setErr(msg(ex)); } };
  const open = async e => { e.preventDefault(); setErr(""); try { setRec((await api.req(`/api/admin/patients/${target.id}/view`, { reason })).patient); setTarget(null); setReason(""); } catch (ex) { setErr(msg(ex)); } };
  return (<>
    <div className="dash-title">Records</div>
    <div className="dash-sub">Read-only. Opening a record needs a written reason; it is recorded in the patient's audit trail and shown to that organization's admins and clinicians.</div>
    <form onSubmit={search} style={{ display: "flex", gap: 8, margin: "12px 0" }}><input style={{ flex: 1, padding: "8px 10px", border: "1px solid var(--bd2)", borderRadius: 7, fontFamily: "inherit" }} placeholder="Search name or MRN (searching is logged)" value={q} onChange={e => setQ(e.target.value)}/><button className="ad-btn pri" type="submit">Search</button></form>
    {err && <div className="ad-err">{err}</div>}
    {rows && <div className="card" style={{ padding: 0, overflow: "auto" }}><div className="ad-scroll"><table><thead><tr><th>Patient</th><th>MRN</th><th>Organization</th><th></th></tr></thead><tbody>
      {rows.map(p => <tr key={p.id}><td><b>{p.name}</b></td><td>{p.mrn || "—"}</td><td>{p.orgName}</td><td><button className="ad-btn" onClick={() => { setTarget(p); setRec(null); }}>Open (read-only)</button></td></tr>)}
      {!rows.length && <tr><td colSpan="4" style={{ color: "var(--tx3)" }}>No matches.</td></tr>}
    </tbody></table></div></div>}
    {target && <form className="card" style={{ marginTop: 12 }} onSubmit={open}>
      <div className="af-label">Reason for accessing {target.name}'s record (min 10 characters)</div>
      <input required minLength={10} maxLength={500} autoFocus style={{ width: "100%", padding: "8px 10px", border: "1px solid var(--bd2)", borderRadius: 7, fontFamily: "inherit", marginBottom: 8 }} value={reason} onChange={e => setReason(e.target.value)} placeholder="e.g. Investigating a model prediction for this cohort"/>
      <button className="ad-btn pri" type="submit">Open and log access</button> <button className="ad-btn" type="button" onClick={() => setTarget(null)}>Cancel</button>
    </form>}
    {rec && <div className="card" style={{ marginTop: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between" }}><b>{rec.name} · {rec.mrn}</b><span className="pill p-blu">READ-ONLY</span></div>
      <div className="dash-sub" style={{ margin: "4px 0 10px" }}>{rec.age} · {rec.gender} · {rec.insurance} · Provider {rec.provider}</div>
      {rec.wounds.map(w => <div key={w.id} style={{ marginBottom: 8 }}><b>{w.type}</b> — {w.location}<div style={{ fontSize: 11, color: "var(--tx2)" }}>{w.assessments.length ? w.assessments.map(a => `${a.date}: PUSH ${a.push}, ${a.area} cm²`).join("  ·  ") : "No assessments"}</div></div>)}
      <div className="ad-h" style={{ marginTop: 6 }}>Billing</div><div style={{ fontSize: 11 }}>{rec.billing.length ? rec.billing.map(b => `${b.date || ""} ${b.status}`).join("  ·  ") : "None"}</div>
      <div className="ad-h">Audit trail (latest)</div>{rec.auditTrail.slice(-8).map(a => <div key={a.id} style={{ fontSize: 11 }}>{fmtTs(a.ts)} · <b>{a.event}</b> · {a.user}</div>)}
      <div style={{ marginTop: 10 }}><button className="ad-btn" onClick={() => setRec(null)}>Close</button></div>
    </div>}
  </>);
}

// ───────────────────────────── Shell ─────────────────────────────────────────
export default function AdminConsole({ user, css, onLogout }) {
  const isSuper = user.role === "super_admin";
  const tabs = isSuper ? [["overview", "Overview"], ["orgs", "Organizations"], ["records", "Records"], ["guidelines", "Guidelines"], ["log", "Access log"]] : [["patients", "Patients"], ["staff", "Staff"], ["guidelines", "Guidelines"], ["log", "Activity"]];
  const [tab, setTab] = useState(tabs[0][0]);
  const org = useLoad(isSuper ? "/api/admin/orgs" : "/api/org");
  return (<>
    <style>{css}{styles}</style>
    <div className="ad">
      <div className="ad-top">
        <div className="tb-brand"><img className="brand-logo" src="/unwound-logo-white.png" alt="unwound.ai" width="120" height="21"/><span>Selma</span><span className={`pill ${isSuper ? "p-pur" : "p-blu"}`}>{isSuper ? "PLATFORM ADMIN" : "ORG ADMIN"}</span>{!isSuper && org.data?.org && <span style={{ fontWeight: 500, color: "var(--tx2)" }}>{org.data.org.name}</span>}</div>
        <div className="ad-user" style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 12 }}>{user.name}<button className="ad-btn" onClick={onLogout}>Sign out</button></div>
      </div>
      <div className="ad-tabs">{tabs.map(([k, l]) => <button key={k} className={`ad-tab ${tab === k ? "on" : ""}`} onClick={() => setTab(k)}>{l}</button>)}</div>
      <div className="ad-body">
        {tab === "overview" && <Overview/>}
        {tab === "orgs" && <Orgs/>}
        {tab === "records" && <Records/>}
        {tab === "patients" && <OrgPatients/>}
        {tab === "staff" && <OrgStaff meId={user.id}/>}
        {tab === "guidelines" && <GuidelinesPanel isSuper={isSuper}/>}
        {tab === "log" && <ActivityLog path={isSuper ? "/api/admin/log" : "/api/org/log"} showOrg={isSuper}/>}
      </div>
    </div>
  </>);
}
