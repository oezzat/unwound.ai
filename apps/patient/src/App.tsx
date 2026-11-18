// @ts-nocheck
import { useState, useEffect, useRef, useCallback } from "react";
import { Ic } from "@wc/shared/icons";
import { CH, EV, nid } from "@wc/shared";
import { VideoCall } from "@wc/shared/webrtc";
import { UI_BASE_CSS } from "@wc/shared/ui";
import { PATIENT_POLISH_CSS, PATIENT_NAVY_CSS } from "./polish";
import Today, { TODAY_CSS } from "./Today";
import { clearImageCache } from "@wc/shared/photo";
import { NotificationBell, NOTIF_CSS, disablePush } from "@wc/shared/notifications";
import { api, bridge, login, session, setOnUnauthorized, SelmaClient } from "./api";

// Patient half of the platform (Selma). Data comes from the API server; the Selma agent runs
// server-side, scoped to the signed-in patient. Safety keyword detection runs on the server too.

const css = UI_BASE_CSS + `
:root{--r:12px}
.phone{max-width:460px;margin:0 auto;min-height:100vh;background:var(--bg);display:flex;flex-direction:column;position:relative;box-shadow:0 0 40px rgba(15,23,42,.08)}

/* ── TOP BAR ── */
.stopbar{background:var(--s1);border-bottom:1px solid var(--bd);padding:12px 16px;display:flex;justify-content:space-between;align-items:center;flex-shrink:0}
.s-glyph{display:inline-block;width:.95em;height:.95em;vertical-align:-.15em;background:currentColor;-webkit-mask:url(/selma-glyph.png) center/contain no-repeat;mask:url(/selma-glyph.png) center/contain no-repeat}
.selma-logo{height:24px;width:auto;display:block}.selma-logo.lg{height:34px;margin-bottom:8px}
.pwr{display:flex;align-items:center;justify-content:center;gap:6px;padding:6px 12px calc(6px + env(safe-area-inset-bottom,0px));font-size:11px;color:var(--tx3);background:var(--s1);flex-shrink:0}.pwr.flat{background:transparent}.pwr img{height:13px;width:auto;display:block;opacity:.9}
.sbrand{display:flex;align-items:center;gap:8px;font-weight:700;font-size:15px}
.sbrand-av{width:30px;height:30px;border-radius:50%;background:linear-gradient(135deg,#0b6bcb,#0ea5a4);color:#fff;display:flex;align-items:center;justify-content:center;font-size:16px}
.sdisc{font-size:11px;color:var(--tx3);text-align:center;padding:6px 14px;border-top:1px solid var(--bd);background:var(--s1)}
.sdisc b{color:var(--red)}
.logout{font-size:11px;background:var(--s3);border:1px solid var(--bd);border-radius:7px;padding:5px 8px;color:var(--tx2);font-family:inherit;cursor:pointer}
.demo-switch{font-size:11px;background:var(--s3);border:1px solid var(--bd);border-radius:7px;padding:5px 8px;color:var(--tx2);font-family:inherit}

/* ── CONTENT ── */
.scontent{flex:1;overflow-y:auto;padding-bottom:6px}

/* ── HOME ── */
.greet-banner{background:linear-gradient(135deg,rgba(130,80,223,.08),rgba(9,105,218,.06));border:1px solid rgba(130,80,223,.2);border-radius:var(--r);margin:14px 16px;padding:14px}
.greet-av{width:36px;height:36px;border-radius:50%;overflow:hidden;display:flex;align-items:center;justify-content:center;flex-shrink:0}.greet-av img{width:100%;height:100%;object-fit:cover;display:block}
.hcard{background:var(--s1);border:1px solid var(--bd);border-radius:var(--r);margin:0 16px 14px;padding:14px;box-shadow:0 1px 2px rgba(31,35,40,.04)}
.hcard-title{font-size:11px;font-weight:700;color:var(--tx3);text-transform:uppercase;letter-spacing:.05em;margin-bottom:8px}
.wound-status-row{display:flex;justify-content:space-between;align-items:center;font-size:12px;color:var(--tx2);padding:4px 0}
.big-cta{display:block;width:calc(100% - 32px);margin:0 16px 16px;background:var(--acc);color:#fff;border:none;border-radius:var(--r);padding:13px;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit;text-align:center}
.big-cta:hover{background:var(--acc-h)}
.streak-ring{display:flex;align-items:center;gap:12px}
.adh-num{font-size:26px;font-weight:700}
.step-mini{display:flex;align-items:center;gap:8px;font-size:12px;padding:5px 0;color:var(--tx2)}
.step-mini.done{color:var(--tx3);text-decoration:line-through}
.unread-badge{background:var(--red);color:#fff;font-size:11px;font-weight:700;border-radius:10px;padding:1px 6px;margin-left:5px}

/* ── CHAT ── */
.schat{display:flex;flex-direction:column;height:calc(100vh - 122px)}
.smsgs{flex:1;overflow-y:auto;padding:14px 16px;display:flex;flex-direction:column;gap:10px}
.sbubble{max-width:82%;padding:10px 13px;border-radius:14px;font-size:13px;line-height:1.55}
.sbubble.selma{background:var(--s1);border:1px solid var(--bd);align-self:flex-start;border-bottom-left-radius:4px}
.sbubble.user{background:var(--acc);color:#fff;align-self:flex-end;border-bottom-right-radius:4px}
.sbubble.tool-chip{align-self:flex-start;background:rgba(26,127,55,.08);border:1px solid rgba(26,127,55,.25);color:var(--grn);font-size:11px;font-weight:600;padding:5px 10px;border-radius:10px}
.sbubble.tool-chip.alert{background:rgba(207,34,46,.08);border-color:rgba(207,34,46,.3);color:var(--red)}
.typing-row{align-self:flex-start;display:flex;gap:4px;padding:10px 13px}
.typing-row .d{width:6px;height:6px;border-radius:50%;background:var(--tx3);animation:tbounce 1s infinite}
.typing-row .d:nth-child(2){animation-delay:.15s}.typing-row .d:nth-child(3){animation-delay:.3s}
@keyframes tbounce{0%,60%,100%{transform:translateY(0);opacity:.4}30%{transform:translateY(-4px);opacity:1}}
.sinput-row{display:flex;gap:8px;padding:10px 14px;border-top:1px solid var(--bd);background:var(--s1);flex-shrink:0}
.sinput-row input{flex:1;border:1px solid var(--bd2);border-radius:20px;padding:10px 15px;font-size:13px;font-family:inherit;outline:none;background:var(--s2)}
.sinput-row input:focus{border-color:var(--pur)}
.ssend{width:38px;height:38px;border-radius:50%;background:linear-gradient(135deg,#6d28d9,#9333ea);border:none;color:#fff;font-size:15px;cursor:pointer;flex-shrink:0}
.quick-row{display:flex;gap:6px;padding:0 14px 10px;flex-wrap:wrap}
.quick-chip{font-size:11px;background:var(--s1);border:1px solid var(--bd2);border-radius:14px;padding:6px 11px;cursor:pointer;color:var(--tx2)}
.quick-chip:hover{background:var(--s3)}

/* ── CARE PLAN ── */
.cp-step{display:flex;align-items:flex-start;gap:10px;background:var(--s1);border:1px solid var(--bd);border-radius:10px;padding:12px;margin:0 16px 8px;cursor:pointer}
.cp-check{width:20px;height:20px;border-radius:50%;border:2px solid var(--bd2);flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:11px;color:#fff;margin-top:1px}
.cp-check.done{background:var(--grn);border-color:var(--grn)}
.cp-label{font-size:13px}
.cp-label.done{color:var(--tx3);text-decoration:line-through}
.redflag-box{background:rgba(207,34,46,.05);border:1px solid rgba(207,34,46,.2);border-radius:var(--r);margin:14px 16px;padding:13px}
.redflag-title{font-size:11px;font-weight:700;color:var(--red);text-transform:uppercase;letter-spacing:.05em;margin-bottom:6px}
.redflag-item{font-size:12px;color:var(--tx2);padding:2px 0}

/* ── MESSAGES ── */
.msg-card{background:var(--s1);border:1px solid var(--bd);border-radius:var(--r);margin:0 16px 10px;padding:13px}
.msg-card.urgent{border-color:rgba(207,34,46,.4);background:rgba(207,34,46,.03)}
.msg-from{font-size:11px;font-weight:700;color:var(--tx3);text-transform:uppercase;letter-spacing:.05em;margin-bottom:5px}
.msg-text{font-size:13px;color:var(--tx)}
.msg-ts{font-size:11px;color:var(--tx3);margin-top:6px}

/* ── TELEHEALTH ── */
.th-invite{background:rgba(9,105,218,.08);border:1px solid rgba(9,105,218,.25);border-radius:var(--r);margin:14px 16px;padding:14px;text-align:center}
.th-call{padding:16px;display:flex;flex-direction:column;gap:12px;height:calc(100vh - 182px)}
.pth-tile{background:#0d1117;border-radius:14px;flex:1;position:relative;display:flex;align-items:center;justify-content:center;min-height:260px}
.pth-avatar{width:90px;height:90px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:30px;font-weight:700;color:#fff}
.pth-label{position:absolute;bottom:10px;left:12px;color:#fff;font-size:11px;background:rgba(0,0,0,.45);padding:4px 9px;border-radius:12px}
.pth-video{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;border-radius:14px;background:#0d1117}
.pth-selfvid{position:absolute;bottom:10px;right:10px;width:92px;height:68px;object-fit:cover;border-radius:8px;border:2px solid rgba(255,255,255,.4);background:#1f2328;transform:scaleX(-1)}
.pth-rec{font-size:11px;color:var(--tx2);text-align:center}
.pth-rec b{color:var(--red)}
.consent-card{background:var(--s1);border:1px solid var(--bd);border-radius:var(--r);padding:14px;font-size:12px;color:var(--tx2);line-height:1.55}
.consent-card b{color:var(--tx)}
.pth-controls{display:flex;justify-content:center;gap:12px}
.pth-btn{width:48px;height:48px;border-radius:50%;border:1px solid var(--bd);background:var(--s1);display:flex;align-items:center;justify-content:center;font-size:17px;cursor:pointer}
.pth-btn.end{background:var(--red);border-color:var(--red);color:#fff}

/* ── BOTTOM NAV ── */
.bnav{position:sticky;bottom:0;left:0;right:0;background:var(--s1);border-top:1px solid var(--bd);display:flex;flex-shrink:0}
.bnav-item{flex:1;display:flex;flex-direction:column;align-items:center;gap:2px;padding:9px 0 10px;cursor:pointer;color:var(--tx3);font-size:11px;font-weight:600;position:relative}
.bnav-item.sel{color:var(--acc)}
.bnav-ic{font-size:17px}
.bnav-dot{position:absolute;top:6px;right:calc(50% - 16px);width:7px;height:7px;border-radius:50%;background:var(--red)}

@keyframes pulse{0%,100%{opacity:1}50%{opacity:.35}}
` + TODAY_CSS + NOTIF_CSS + PATIENT_POLISH_CSS + PATIENT_NAVY_CSS;
function HomeScreen({ patient, unreadCount, telehealthInvite, onStartCheckin, onGoTab }) {
  const wound = patient.wounds?.[0];
  const last = wound?.assessments?.[wound.assessments.length-1];
  const pendingSteps = patient.carePlan.steps.filter(s=>!s.done);

  return (
    <div>
      <div className="greet-banner">
        <div style={{ display:"flex", gap:10 }}>
          <div className="greet-av"><img src="/selma-icon.png" alt="" width="34" height="34"/></div>
          <div>
            <div style={{ fontWeight:700, fontSize:13.5, marginBottom:3, color:"#fff" }}>Hi {patient.name.split(" ")[0]}, I'm Selma</div>
            <div style={{ fontSize:12, color:"rgba(255,255,255,.85)" }}>
              {pendingSteps.length>0
                ? `You've got ${pendingSteps.length} care step${pendingSteps.length!==1?"s":""} left today. Want to check in?`
                : "All your steps are done for today — great work! I'm here if anything feels off."}
            </div>
          </div>
        </div>
      </div>

      {telehealthInvite && (
        <div className="th-invite">
          <div style={{ fontSize:12.5, fontWeight:700, marginBottom:4 }}><Ic n="video"/> {telehealthInvite.provider || "Your provider"} started a video visit</div>
          <div style={{ fontSize:11, color:"var(--tx2)", marginBottom:10 }}>Join now to connect live.</div>
          <button className="big-cta" style={{ margin:0, width:"100%" }} onClick={() => onGoTab("telehealth")}>Join video visit</button>
        </div>
      )}

      <Today patient={patient} onStartCheckin={onStartCheckin}/>

      <div className="hcard">
        <div className="hcard-title">Your wound</div>
        <div className="wound-status-row"><span>{wound?.type}</span><span>{wound?.location}</span></div>
        {last && <>
          <div className="wound-status-row"><span>PUSH score</span><b style={{ color: last.push>=15?"var(--red)":last.push>=10?"var(--org)":"var(--grn)" }}>{last.push}/17</b></div>
          <div className="wound-status-row"><span>Last checked</span><span>{last.date} · {last.method}</span></div>
        </>}
      </div>

      <div className="hcard">
        <div className="hcard-title">Today's adherence</div>
        <div className="streak-ring">
          <div className="adh-num" style={{ color:patient.adherence>=70?"var(--grn)":patient.adherence>=40?"var(--yel)":"var(--red)" }}>{patient.adherence}%</div>
          <div style={{ flex:1 }}>
            {patient.carePlan.steps.map(s => (
              <div key={s.id} className={`step-mini ${s.done?"done":""}`}>{s.done?<Ic n="check"/>:"○"} {s.label}</div>
            ))}
          </div>
        </div>
      </div>

      <button className="big-cta" onClick={onStartCheckin}>Start today's check-in with Selma</button>

      {unreadCount>0 && (
        <div className="hcard" style={{ borderColor:"rgba(207,34,46,.35)", cursor:"pointer" }} onClick={() => onGoTab("messages")}>
          <div style={{ fontSize:12.5, fontWeight:700, color:"var(--red)" }}><Ic n="message"/> {unreadCount} new message{unreadCount!==1?"s":""} from your care team</div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// CHAT SCREEN (Selma agent — streaming, tool calls)
// ═══════════════════════════════════════════════════════════════════════════════
function ChatScreen({ isRunning, messages, send }) {
  const [input, setInput] = useState("");
  const endRef = useRef(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior:"smooth" }); }, [messages, isRunning]);

  const submit = (text) => { if (!text.trim()) return; send(text); setInput(""); };

  const toolLabel = (t) => ({
    submit_checkin:<><Ic n="check"/> Check-in logged to your care team</>,
    report_symptom:<><Ic n="siren"/> Your care team has been notified</>,
    safety:<><Ic n="siren"/> Your care team has been alerted</>,
    complete_care_step:<><Ic n="check"/> Care plan step marked complete</>,
    request_telehealth:<><Ic n="video"/> Video visit requested</>,
    get_my_plan:"Looked up your care plan…",
    mark_messages_read:"Marked messages as read",
  }[t] || t);

  return (
    <div className="schat">
      <div className="smsgs">
        {messages.length===0 && (
          <div style={{ textAlign:"center", color:"var(--tx3)", fontSize:12, marginTop:30 }}>Ask Selma anything about your wound care, or tap a suggestion below to get started.</div>
        )}
        {messages.map(m => m.role==="tool" ? (
          <div key={m.id} className={`sbubble tool-chip ${m.alert?"alert":""}`}>{toolLabel(m.toolName)}</div>
        ) : (
          <div key={m.id} className={`sbubble ${m.role==="user"?"user":"selma"}`}>{m.text}{m.streaming && <span style={{ opacity:.4 }}>▍</span>}</div>
        ))}
        {isRunning && !messages.some(m=>m.streaming) && (
          <div className="typing-row"><div className="d"/><div className="d"/><div className="d"/></div>
        )}
        <div ref={endRef}/>
      </div>
      <div className="quick-row">
        <div className="quick-chip" onClick={() => submit("Start my daily check-in")}>Start check-in</div>
        <div className="quick-chip" onClick={() => submit("I have a concern about my wound")}>Report a concern</div>
        <div className="quick-chip" onClick={() => submit("What's left on my care plan today?")}>What's left today?</div>
      </div>
      <div className="sinput-row">
        <input placeholder="Message Selma…" value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e => e.key==="Enter" && submit(input)} disabled={isRunning}/>
        <button className="ssend" aria-label="Send message" onClick={() => submit(input)} disabled={isRunning}><Ic n="send"/></button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// CARE PLAN SCREEN
// ═══════════════════════════════════════════════════════════════════════════════
function CarePlanScreen({ patient, onToggleStep }) {
  return (
    <div style={{ paddingTop:14 }}>
      <div style={{ padding:"0 16px 10px", fontSize:11, fontWeight:700, color:"var(--tx3)", textTransform:"uppercase", letterSpacing:".05em" }}>Today's steps</div>
      {patient.carePlan.steps.map(s => (
        <div key={s.id} className="cp-step" role="checkbox" aria-checked={!!s.done} tabIndex={0} onClick={() => onToggleStep(s.id)} onKeyDown={e => (e.key==="Enter"||e.key===" ") && (e.preventDefault(), onToggleStep(s.id))}>
          <div className={`cp-check ${s.done?"done":""}`}>{s.done?<Ic n="check"/>:""}</div>
          <div className={`cp-label ${s.done?"done":""}`}>{s.label}</div>
        </div>
      ))}
      <div className="redflag-box">
        <div className="redflag-title"><Ic n="warn"/> Call Selma or your provider right away if you notice</div>
        {patient.carePlan.redFlags.map((r,i) => <div key={i} className="redflag-item">• {r}</div>)}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MESSAGES SCREEN
// ═══════════════════════════════════════════════════════════════════════════════
function MessagesScreen({ patient }) {
  const msgs = [...(patient.messages||[])].reverse();
  return (
    <div style={{ paddingTop:14 }}>
      {msgs.length===0 ? (
        <div style={{ textAlign:"center", color:"var(--tx3)", fontSize:12, marginTop:30 }}>No messages from your care team yet.</div>
      ) : msgs.map(m => (
        <div key={m.id} className={`msg-card ${m.urgent?"urgent":""}`}>
          <div className="msg-from">{m.urgent?<><Ic n="siren"/>{" "}</>:""}{patient.provider}</div>
          <div className="msg-text">{m.text}</div>
          <div className="msg-ts">{new Date(m.ts).toLocaleString()}</div>
        </div>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TELEHEALTH SCREEN
// ═══════════════════════════════════════════════════════════════════════════════
function TelehealthScreen({ patient, tele, onJoin, onLeave, onRequest }) {
  const remoteRef = useRef(null), localRef = useRef(null);
  const [muted, setMuted] = useState(false), [camOff, setCamOff] = useState(false);
  useEffect(() => { if (remoteRef.current && tele.remote) { remoteRef.current.srcObject = tele.remote; remoteRef.current.play?.().catch(() => {}); } }, [tele.remote, tele.phase]);
  useEffect(() => { if (localRef.current && tele.local) localRef.current.srcObject = tele.local; }, [tele.local, tele.phase]);

  if (tele.phase === "idle" || tele.phase === "joining") {
    const inv = tele.invite;
    return (
      <div style={{ padding:16 }}>
        {inv ? (
          <div className="th-invite" style={{ textAlign:"left" }}>
            <div style={{ fontWeight:700, marginBottom:5, textAlign:"center" }}><Ic n="video"/> {inv.provider || patient.provider} is ready for you</div>
            {inv.scribe ? (
              <div className="consent-card" style={{ marginBottom:10 }}>
                <b>AI transcription (optional).</b> Your care team can use an AI scribe that listens to this video visit and writes it up so your clinician can document it and suggest billing codes.
                Audio is sent to a secure speech-to-text service{inv.mock ? " (this demo uses a simulated transcript — no audio is transcribed)" : " (AWS HealthScribe)"}. The transcript is kept in your medical record and reviewed by your clinician.
                <br/><b>You can say no and still have your visit.</b>
              </div>
            ) : (
              <div style={{ fontSize:11, color:"var(--tx2)", marginBottom:10, textAlign:"center" }}>This visit is not recorded or transcribed.</div>
            )}
            {tele.err && <div style={{ color:"var(--red)", fontSize:12, marginBottom:8 }}>{tele.err}</div>}
            {inv.scribe ? <>
              <button className="big-cta" style={{ margin:"0 0 8px", width:"100%" }} disabled={tele.phase==="joining"} onClick={() => onJoin(true)}>{tele.phase==="joining" ? "Connecting…" : "Join and allow AI transcription"}</button>
              <button className="big-cta" style={{ margin:0, width:"100%", background:"var(--s1)", color:"var(--acc)", border:"1px solid var(--acc)" }} disabled={tele.phase==="joining"} onClick={() => onJoin(false)}>Join without transcription</button>
            </> : (
              <button className="big-cta" style={{ margin:0, width:"100%" }} disabled={tele.phase==="joining"} onClick={() => onJoin(false)}>{tele.phase==="joining" ? "Connecting…" : "Join video visit"}</button>
            )}
          </div>
        ) : (
          <div className="hcard">
            <div className="hcard-title">Telehealth</div>
            <div style={{ fontSize:12.5, color:"var(--tx2)", marginBottom:12 }}>No visit is scheduled right now. If you'd like your provider to see your wound over video, you can send a request.</div>
            {tele.requested ? <div style={{ fontSize:12, color:"var(--grn)", fontWeight:600 }}><Ic n="check"/> Request sent — your care team has been notified.</div>
              : <button className="big-cta" style={{ margin:0 }} onClick={onRequest}>Request a video visit</button>}
          </div>
        )}
      </div>
    );
  }

  const connected = tele.state === "connected";
  return (
    <div className="th-call">
      <div style={{ display:"flex", justifyContent:"space-between", fontSize:11, color:"var(--tx2)" }}>
        <span>{connected ? <><Ic n="live"/> Live</> : tele.state === "failed" ? <><Ic n="warn"/> Connection problem</> : <><Ic n="waiting"/> Waiting for your provider…</>} · {patient.provider}</span>
      </div>
      <div className="pth-tile">
        <video ref={remoteRef} className="pth-video" autoPlay playsInline style={{ display: connected ? "block" : "none" }}/>
        {!connected && <div className="pth-avatar" style={{ background:"#6d28d9" }}>{(patient.provider||"Dr").split(" ").map(n=>n[0]).slice(0,2).join("")}</div>}
        <div className="pth-label">{patient.provider}</div>
        <video ref={localRef} className="pth-selfvid" autoPlay playsInline muted/>
      </div>
      <div className="pth-rec">{tele.consent ? <><b>● AI transcription is on</b> (you agreed)</> : "Not being transcribed"}</div>
      <div className="pth-controls">
        <div className="pth-btn" onClick={() => setMuted(m => { tele.call?.setMuted(!m); return !m; })}>{muted?<Ic n="mic-off"/>:<Ic n="mic"/>}</div>
        <div className="pth-btn" onClick={() => setCamOff(c => { tele.call?.setCameraOff(!c); return !c; })}>{camOff?<Ic n="video-off"/>:<Ic n="video"/>}</div>
        <div className="pth-btn end" onClick={onLeave}><Ic n="end-call"/></div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// LOGIN + ROOT
// ═══════════════════════════════════════════════════════════════════════════════
const DEMO_ACCOUNTS = [["james.okafor@demo.test","James Okafor"],["margaret.chen@demo.test","Margaret Chen"],["dorothy.simmons@demo.test","Dorothy Simmons"],["robert.tanaka@demo.test","Robert Tanaka"]];

function PoweredBy({ flat }) { return <div className={`pwr${flat?" flat":""}`}>Powered by <img src={flat?"/unwound-logo-white.png":"/unwound-logo.png"} alt="unwound.ai" width="76" height="13"/></div>; }
function LoginScreen({ onLoggedIn }) {
  const demo = import.meta.env.VITE_DEMO_MODE === "true";
  const [email, setEmail] = useState(demo ? DEMO_ACCOUNTS[0][0] : "");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault(); setBusy(true); setErr("");
    try { onLoggedIn(await login(email.trim(), password)); }
    catch (ex) { setErr(ex?.message || "Sign-in failed"); }
    finally { setBusy(false); }
  };
  const field = { width:"100%", border:"1px solid var(--bd2)", borderRadius:8, padding:"10px 12px", fontSize:13, fontFamily:"inherit", marginBottom:10 };
  return (
    <>
      <style>{css}</style>
      <div className="phone login-bg" style={{ justifyContent:"center" }}>
        <form onSubmit={submit} className="hcard" style={{ margin:"0 20px" }}>
          <img className="selma-logo lg" src="/selma-logo.png" alt="Selma" width="110" height="31"/>
          <div style={{ fontSize:12, color:"var(--tx2)", marginBottom:14 }}>Sign in to your wound-care companion</div>
          {demo ? (
            <select style={field} value={email} onChange={e=>setEmail(e.target.value)}>{DEMO_ACCOUNTS.map(([e,n]) => <option key={e} value={e}>Demo patient: {n}</option>)}</select>
          ) : (
            <input style={field} type="email" autoComplete="username" placeholder="Email" required value={email} onChange={e=>setEmail(e.target.value)}/>
          )}
          <input style={field} type="password" autoComplete="current-password" placeholder="Password" required value={password} onChange={e=>setPassword(e.target.value)}/>
          {err && <div style={{ color:"var(--red)", fontSize:12, marginBottom:8 }}>{err}</div>}
          <button className="big-cta" style={{ margin:0, width:"100%" }} type="submit" disabled={busy}>{busy ? "Signing in…" : "Sign in"}</button>
          <div style={{ fontSize:11, color:"var(--tx3)", marginTop:12 }}>Selma is an AI assistant and is not a substitute for emergency care. In an emergency call 911.{demo && " Demo mode: demo data only — never enter real health information."}</div>
        </form>
        <div style={{ marginTop:18 }}><PoweredBy flat/></div>
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
    api.req("/api/auth/me").then(r => { if (r.user.role === "patient") setUser(r.user); else session.clear(); }).catch(() => {}).finally(() => setChecking(false));
  }, []);
  if (checking) return null;
  if (!user) return <LoginScreen onLoggedIn={setUser}/>;
  return <App key={user.id} onLogout={async () => { await disablePush(api); clearImageCache(); session.clear(); setUser(null); }}/>;
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN APP
// ═══════════════════════════════════════════════════════════════════════════════
function App({ onLogout }) {
  const [patient, setPatient] = useState(null);
  const [loadErr, setLoadErr] = useState("");
  const [tab, setTab] = useState("home");
  const [messages, setMessages] = useState([]);
  const [isRunning, setIsRunning] = useState(false);
  const [tele, setTele] = useState({ phase:"idle", invite:null, state:"idle", err:"", consent:false, remote:null, local:null, call:null, requested:false });
  const callRef = useRef(null), inviteRef = useRef(null);
  const telehealthInvite = tele.phase === "idle" ? tele.invite : null;
  const agentRef = useRef(new SelmaClient());
  const streamRef = useRef({});
  const refreshTimer = useRef(null);

  const load = useCallback(async () => {
    try { const { patient: p } = await api.req("/api/me/patient"); setPatient(p); setLoadErr(""); }
    catch (e) { setLoadErr(e?.message || "Could not load your record"); }
  }, []);

  useEffect(() => {
    load();
    // A visit may already be in progress when the app opens.
    api.req("/api/me/telehealth/active").then(({ session }) => {
      if (session) { inviteRef.current = { sessionId: session.id, provider: null, scribe: session.scribe.provider !== "none", mock: session.scribe.provider === "mock" }; setTele(t => ({ ...t, invite: inviteRef.current })); }
    }).catch(() => {});
    agentRef.current.history().then(h => setMessages(h.map(m => ({ id:nid(), role:m.role==="user"?"user":"selma", text:m.text })))).catch(() => {});
    const stop = api.openEvents(e => bridge.dispatch(e));
    const refresh = () => { clearTimeout(refreshTimer.current); refreshTimer.current = setTimeout(load, 150); };
    const u = [
      bridge.subscribe(CH.STORE_UPDATED, refresh),
      bridge.subscribe(CH.AUGI_TELEHEALTH_START, ev => { if (ev.sessionId) { inviteRef.current = { sessionId: ev.sessionId, provider: ev.provider, scribe: !!ev.scribe, mock: !!ev.mock }; setTele(t => t.phase === "idle" ? { ...t, invite: inviteRef.current, err:"" } : t); } }),
      bridge.subscribe(CH.AUGI_TELEHEALTH_END, ev => { if (!ev.sessionId || ev.sessionId === inviteRef.current?.sessionId) endLocalCall(); }),
      bridge.subscribe(CH.TELEHEALTH_SIGNAL, ev => {
        if (ev.sessionId !== inviteRef.current?.sessionId || ev.from !== "clinician") return;
        if (ev.kind === "bye") endLocalCall(); else callRef.current?.handleSignal(ev.kind, ev.data);
      }),
      bridge.subscribe(CH.AUGI_MESSAGE, ev => { if (ev.text) setMessages(m => [...m, { id:nid(), role:"selma", text:`New message from your care team: "${ev.text}"` }]); refresh(); }),
    ];
    return () => { stop(); u.forEach(f => f()); };
  }, []);

  // Owns the agent run loop's event stream so BOTH the chat input and the Home "start check-in" CTA drive the same conversation.
  const handleEvent = useCallback((event) => {
    switch (event.type) {
      case EV.TEXT_START:
        streamRef.current[event.messageId] = "";
        setMessages(m => [...m, { id:event.messageId, role:"selma", text:"", streaming:true }]);
        break;
      case EV.TEXT_CONTENT:
        streamRef.current[event.messageId] = (streamRef.current[event.messageId]||"") + event.delta;
        setMessages(m => m.map(x => x.id===event.messageId ? { ...x, text:streamRef.current[event.messageId] } : x));
        break;
      case EV.TEXT_END:
        setMessages(m => m.map(x => x.id===event.messageId ? { ...x, streaming:false } : x));
        break;
      case EV.TOOL_START:
        setMessages(m => [...m, { id:nid(), role:"tool", toolName:event.toolName, alert:event.toolName==="report_symptom" }]);
        break;
      case EV.TOOL_END: load(); break;
      case EV.SAFETY_ALERT:
        // Deterministic server-side detection — shown even if the AI is unavailable.
        setMessages(m => [...m, { id:nid(), role:"tool", toolName:"safety", alert:true },
          { id:nid(), role:"selma", text: event.severity==="critical"
            ? "This could be serious. If you have chest pain, trouble breathing, fainting, or spreading red streaks with fever, call 911 or go to the nearest emergency room now. Your care team has been alerted."
            : "I've alerted your care team about this. If it gets worse or you feel very unwell, call your provider right away or go to the emergency room." }]);
        break;
      case EV.RUN_STARTED: setIsRunning(true); break;
      case EV.RUN_ERROR:
        setMessages(m => [...m, { id:nid(), role:"selma", text: event.message }]);
        setIsRunning(false); break;
      case EV.RUN_FINISHED: setIsRunning(false); load(); break;
    }
  }, [load]);

  function endLocalCall() {
    callRef.current?.close(); callRef.current = null; inviteRef.current = null;
    setTele({ phase:"idle", invite:null, state:"idle", err:"", consent:false, remote:null, local:null, call:null, requested:false });
  }
  const joinVisit = async (consent) => {
    const inv = inviteRef.current; if (!inv) return;
    setTele(t => ({ ...t, phase:"joining", err:"" }));
    try {
      const cfg = await api.req("/api/telehealth/ice");
      const call = new VideoCall({
        role:"patient", iceServers:cfg.iceServers,
        sendSignal:(kind, data) => api.req(`/api/telehealth/${inv.sessionId}/signal`, { kind, data }),
        onRemoteStream:(s) => setTele(t => ({ ...t, remote: s })),
        onState:(st) => setTele(t => ({ ...t, state: st })),
      });
      callRef.current = call;
      const local = await call.startMedia().catch(() => { throw new Error("We couldn't access your camera or microphone. Check your browser permissions and try again."); });
      setTele(t => ({ ...t, phase:"in-call", consent, local, call }));
      await api.req("/api/me/telehealth/join", { sessionId: inv.sessionId, consent });   // clinician is told only once we're ready to receive their offer
    } catch (e) {
      callRef.current?.close(); callRef.current = null;
      setTele(t => ({ ...t, phase:"idle", err: e?.message || "Could not join the visit", local:null, call:null }));
    }
  };
  const leaveVisit = async () => {
    const inv = inviteRef.current;
    if (inv) await api.req(`/api/telehealth/${inv.sessionId}/signal`, { kind:"bye" }).catch(() => {});
    endLocalCall();
  };
  const requestVisit = async () => { try { await api.req("/api/me/telehealth/join", {}); setTele(t => ({ ...t, requested:true })); } catch {} };

  const send = useCallback(async (text) => {
    if (isRunning || !text.trim()) return;
    setMessages(m => [...m, { id:nid(), role:"user", text }]);
    setIsRunning(true);
    await agentRef.current.run(text, handleEvent);
  }, [isRunning, handleEvent]);

  const toggleStep = async (stepId) => {
    const step = patient.carePlan.steps.find(s => s.id===stepId);
    if (!step) return;
    const done = !step.done;
    setPatient(p => ({ ...p, carePlan:{ ...p.carePlan, steps:p.carePlan.steps.map(s => s.id===stepId ? { ...s, done } : s) } }));
    try { await api.req(`/api/me/care-steps/${stepId}`, { done }); } catch {}
    load();
  };

  const goTab = (t) => {
    setTab(t);
    if (t === "messages") api.req("/api/me/messages/read", {}).then(load).catch(() => {});
  };

  const unreadCount = (patient?.messages||[]).filter(m=>!m.read).length;

  if (!patient) return <><style>{css}</style><div style={{ padding:20 }}>{loadErr ? <>{loadErr} <button className="logout" onClick={onLogout}>Sign out</button></> : <div aria-busy="true" aria-label="Loading"><div className="skeleton skeleton-line w60" style={{ height:22 }}/><div className="skeleton skeleton-card" style={{ marginTop:14 }}/><div className="skeleton skeleton-card" style={{ marginTop:10 }}/></div>}</div></>;

  return (
    <>
      <style>{css}</style>
      <div className="phone">
        <div className="stopbar">
          <img className="selma-logo" src="/selma-logo-white.png" alt="Selma" width="84" height="24"/>
          <div style={{ display:"flex", alignItems:"center", gap:4 }}>
            <NotificationBell api={api} audience="patient" subscribe={cb => bridge.subscribe(CH.NOTIFY, cb)} onOpen={it => { if (it.link?.tab) goTab(it.link.tab); }}/>
            <button className="logout" onClick={onLogout}>Sign out</button>
          </div>
        </div>

        <div className="scontent">
          {tab==="home" && <HomeScreen patient={patient} unreadCount={unreadCount} telehealthInvite={telehealthInvite} onGoTab={goTab} onStartCheckin={() => { setTab("chat"); send("I'd like to start my daily check-in"); }}/>}
          {tab==="chat" && <ChatScreen isRunning={isRunning} messages={messages} send={send}/>}
          {tab==="careplan" && <CarePlanScreen patient={patient} onToggleStep={toggleStep}/>}
          {tab==="messages" && <MessagesScreen patient={patient}/>}
          {tab==="telehealth" && <TelehealthScreen patient={patient} tele={tele} onJoin={joinVisit} onLeave={leaveVisit} onRequest={requestVisit}/>}
        </div>

        <div className="sdisc">Selma is an AI assistant, not a substitute for emergency care. <b>In an emergency, call 911.</b></div>
        <PoweredBy/>
        {tab!=="chat" && (
          <div className="bnav" role="tablist">
            {[["home",<Ic n="home"/>,"Home"],["chat",<span className="s-glyph" aria-hidden/>,"Selma"],["careplan",<Ic n="plan"/>,"Care Plan"],["messages",<Ic n="message"/>,"Messages"],["telehealth",<Ic n="video"/>,"Video Visit"]].map(([id,ic,label]) => (
              <div key={id} className={`bnav-item ${tab===id?"sel":""}`} role="tab" aria-selected={tab===id} tabIndex={0} onClick={() => goTab(id)} onKeyDown={e => (e.key==="Enter"||e.key===" ") && (e.preventDefault(), goTab(id))}>
                {id==="messages" && unreadCount>0 && <div className="bnav-dot"/>}
                {id==="telehealth" && (telehealthInvite || tele.phase==="in-call") && <div className="bnav-dot"/>}
                <div className="bnav-ic">{ic}</div>{label}
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

