// Browser-only helpers (import from "@wc/shared/webrtc"): 1:1 WebRTC video call + 16 kHz stereo PCM capture for the AI scribe.
// The server only relays signaling (SDP/ICE); media flows peer-to-peer or through your TURN server.

export type CallState = "idle" | "media" | "connecting" | "connected" | "disconnected" | "failed" | "ended";
export interface CallOptions {
  role: "clinician" | "patient";
  iceServers: any[];
  sendSignal: (kind: "offer" | "answer" | "ice" | "bye", data?: any) => Promise<void>;
  onRemoteStream: (s: MediaStream) => void;
  onState: (s: CallState) => void;
}

export class VideoCall {
  localStream: MediaStream | null = null;
  remoteStream = new MediaStream();
  private pc: RTCPeerConnection | null = null;
  private pendingIce: RTCIceCandidateInit[] = [];
  private closed = false;
  constructor(private o: CallOptions) {}

  /** Ask for camera+mic; fall back to audio-only if there is no camera. Throws if neither is available. */
  async startMedia(): Promise<MediaStream> {
    const audio = { echoCancellation: true, noiseSuppression: true, autoGainControl: true };
    try { this.localStream = await navigator.mediaDevices.getUserMedia({ audio, video: { width: { ideal: 640 }, height: { ideal: 480 }, frameRate: { ideal: 24 } } }); }
    catch { this.localStream = await navigator.mediaDevices.getUserMedia({ audio, video: false }); }
    this.o.onState("media");
    return this.localStream;
  }

  private ensurePc(): RTCPeerConnection {
    if (this.pc) return this.pc;
    const pc = new RTCPeerConnection({ iceServers: this.o.iceServers });
    this.pc = pc;
    this.localStream?.getTracks().forEach(t => pc.addTrack(t, this.localStream!));
    pc.ontrack = e => { e.streams[0]?.getTracks().forEach(t => { if (!this.remoteStream.getTracks().includes(t)) this.remoteStream.addTrack(t); }); this.o.onRemoteStream(this.remoteStream); };
    pc.onicecandidate = e => { if (e.candidate) void this.o.sendSignal("ice", e.candidate.toJSON()).catch(() => {}); };
    pc.onconnectionstatechange = () => {
      if (this.closed) return;
      const s = pc.connectionState;
      if (s === "connected") this.o.onState("connected");
      else if (s === "connecting") this.o.onState("connecting");
      else if (s === "disconnected") { this.o.onState("disconnected"); setTimeout(() => { if (!this.closed && this.pc?.connectionState === "disconnected") void this.restartIce(); }, 4000); }
      else if (s === "failed") { this.o.onState("failed"); void this.restartIce(); }
    };
    return pc;
  }

  /** Clinician side: create and send the offer (call once the patient has joined). */
  async callRemote(iceRestart = false) {
    if (this.o.role !== "clinician") return;
    const pc = this.ensurePc();
    this.o.onState("connecting");
    const offer = await pc.createOffer({ iceRestart });
    await pc.setLocalDescription(offer);
    await this.o.sendSignal("offer", { type: offer.type, sdp: offer.sdp });
  }
  private async restartIce() { if (this.o.role === "clinician" && !this.closed && this.pc && this.pc.connectionState !== "connected") { try { await this.callRemote(true); } catch {} } }

  async handleSignal(kind: string, data: any) {
    if (this.closed) return;
    try {
      if (kind === "offer" && this.o.role === "patient") {
        const pc = this.ensurePc();
        await pc.setRemoteDescription(data);
        for (const c of this.pendingIce.splice(0)) await pc.addIceCandidate(c).catch(() => {});
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        this.o.onState("connecting");
        await this.o.sendSignal("answer", { type: answer.type, sdp: answer.sdp });
      } else if (kind === "answer" && this.o.role === "clinician" && this.pc) {
        await this.pc.setRemoteDescription(data);
        for (const c of this.pendingIce.splice(0)) await this.pc.addIceCandidate(c).catch(() => {});
      } else if (kind === "ice") {
        if (this.pc?.remoteDescription) await this.pc.addIceCandidate(data).catch(() => {});
        else this.pendingIce.push(data);
      } else if (kind === "bye") { this.o.onState("ended"); }
    } catch (e) { console.error("[call] signal error", kind, e); }
  }

  setMuted(m: boolean) { this.localStream?.getAudioTracks().forEach(t => (t.enabled = !m)); }
  setCameraOff(off: boolean) { this.localStream?.getVideoTracks().forEach(t => (t.enabled = !off)); }
  get hasVideo() { return !!this.localStream?.getVideoTracks().length; }

  close() {
    this.closed = true;
    this.pc?.close(); this.pc = null;
    this.localStream?.getTracks().forEach(t => t.stop());
    this.o.onState("ended");
  }
}

// ── Scribe audio capture (clinician browser) ────────────────────────────────────
// Mixes the clinician mic (channel 0) and the patient's remote audio (channel 1) into 16 kHz,
// 16-bit, 2-channel interleaved PCM and streams it to the API over a WebSocket (100 ms chunks).
// NOTE: Chrome only delivers remote WebRTC audio to Web Audio if the stream is ALSO attached to a playing media element.

const WORKLET = `
class PcmInterleave extends AudioWorkletProcessor {
  constructor(){ super(); this.buf = new Int16Array(3200); this.n = 0; }
  process(inputs){
    const inp = inputs[0]; if (!inp || !inp.length) return true;
    const L = inp[0], R = inp[1] || null, len = L.length;
    for (let i = 0; i < len; i++){
      this.buf[this.n++] = Math.max(-1, Math.min(1, L[i])) * 0x7fff;
      this.buf[this.n++] = Math.max(-1, Math.min(1, R ? R[i] : 0)) * 0x7fff;
      if (this.n >= this.buf.length){ const out = this.buf.slice().buffer; this.port.postMessage(out, [out]); this.n = 0; }
    }
    return true;
  }
}
registerProcessor('pcm-interleave', PcmInterleave);`;

export interface ScribeSegmentMsg { id: string; speaker: "clinician" | "patient"; text: string; partial: boolean }
export type ScribeStatus = "connecting" | "live" | "reconnecting" | "finishing" | "done" | "error";

export class ScribeCapture {
  private ws: WebSocket | null = null;
  private ctx: AudioContext | null = null;
  private node: AudioWorkletNode | null = null;
  private stopped = false; private ready = false; private retries = 0;
  mock = false;
  constructor(private o: {
    apiBase: string; local: MediaStream; remote: MediaStream;
    getToken: () => Promise<{ token: string; path: string; mock?: boolean }>;
    onSegment: (s: ScribeSegmentMsg) => void; onStatus: (s: ScribeStatus, detail?: string) => void;
  }) {}

  async start() {
    this.o.onStatus("connecting");
    this.ctx = new AudioContext({ sampleRate: 16000 });
    await this.ctx.resume();
    const merger = this.ctx.createChannelMerger(2);
    if (this.o.local.getAudioTracks().length) this.ctx.createMediaStreamSource(new MediaStream(this.o.local.getAudioTracks())).connect(merger, 0, 0);
    if (this.o.remote.getAudioTracks().length) this.ctx.createMediaStreamSource(new MediaStream(this.o.remote.getAudioTracks())).connect(merger, 0, 1);
    const url = URL.createObjectURL(new Blob([WORKLET], { type: "application/javascript" }));
    await this.ctx.audioWorklet.addModule(url); URL.revokeObjectURL(url);
    this.node = new AudioWorkletNode(this.ctx, "pcm-interleave", { numberOfInputs: 1, numberOfOutputs: 1, channelCount: 2, channelCountMode: "explicit", outputChannelCount: [1] });
    this.node.port.onmessage = e => { if (this.ready && this.ws?.readyState === WebSocket.OPEN) this.ws.send(e.data as ArrayBuffer); };
    const mute = this.ctx.createGain(); mute.gain.value = 0;
    merger.connect(this.node); this.node.connect(mute); mute.connect(this.ctx.destination);
    await this.connect();
  }

  private async connect() {
    this.ready = false;
    const t = await this.o.getToken();
    this.mock = !!t.mock;
    const wsBase = this.o.apiBase.replace(/\/$/, "").replace(/^http/, "ws");
    const ws = new WebSocket(`${wsBase}${t.path}?token=${encodeURIComponent(t.token)}`);
    ws.binaryType = "arraybuffer";
    this.ws = ws;
    ws.onmessage = ev => {
      let m: any; try { m = JSON.parse(String(ev.data)); } catch { return; }
      if (m.type === "ready") { this.ready = true; this.retries = 0; this.o.onStatus("live"); }
      else if (m.type === "segment") this.o.onSegment(m.segment);
      else if (m.type === "error") this.o.onStatus("error", m.message);
      else if (m.type === "done") this.o.onStatus("done");
    };
    ws.onclose = () => {
      this.ready = false;
      if (this.stopped || ws !== this.ws) return;
      if (this.retries++ < 5) { this.o.onStatus("reconnecting"); setTimeout(() => { if (!this.stopped) this.connect().catch(() => this.o.onStatus("error", "Could not reconnect")); }, 1000 * this.retries); }
      else this.o.onStatus("error", "Connection lost");
    };
  }

  /** Ask the server to finish (starts clinical-note generation) and wait briefly for confirmation. */
  async stop(waitMs = 8000) {
    this.stopped = true;
    this.o.onStatus("finishing");
    const ws = this.ws;
    if (ws && ws.readyState === WebSocket.OPEN) {
      const done = new Promise<void>(res => { const prev = ws.onmessage; ws.onmessage = ev => { (prev as any)?.call(ws, ev); try { if (JSON.parse(String(ev.data)).type === "done") res(); } catch {} }; ws.onclose = () => res(); });
      ws.send(JSON.stringify({ type: "end" }));
      await Promise.race([done, new Promise(r => setTimeout(r, waitMs))]);
    }
    try { ws?.close(); } catch {}
    this.node?.disconnect(); await this.ctx?.close().catch(() => {});
    this.o.onStatus("done");
  }
}
