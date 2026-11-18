// Browser-side API client shared by both apps: bearer-token REST, fetch-streaming SSE
// (EventSource can't send an Authorization header), and a tiny pub/sub "bridge".

export type SseHandler = (event: any) => void;

export class ApiError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

export function createApi(opts: { baseUrl: string; getToken: () => string | null; onUnauthorized?: () => void }) {
  const base = opts.baseUrl.replace(/\/$/, "");
  const headers = (json = true): Record<string, string> => {
    const h: Record<string, string> = {};
    if (json) h["content-type"] = "application/json";
    const t = opts.getToken();
    if (t) h.authorization = `Bearer ${t}`;
    return h;
  };
  async function fail(res: Response): Promise<never> {
    let msg = res.statusText;
    try { const j = await res.json(); msg = j.error || msg; } catch {}
    if (res.status === 401) opts.onUnauthorized?.();
    throw new ApiError(res.status, msg);
  }
  async function req<T = any>(path: string, body?: unknown, method?: string): Promise<T> {
    const res = await fetch(base + path, { method: method || (body !== undefined ? "POST" : "GET"), headers: headers(), body: body !== undefined ? JSON.stringify(body) : undefined });
    if (!res.ok) await fail(res);
    return res.status === 204 ? (undefined as T) : res.json();
  }

  /** Read an SSE response body, calling onData for each `data:` JSON frame. */
  async function readSse(res: Response, onData: SseHandler) {
    if (!res.body) return;
    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let buf = "";
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      let i: number;
      while ((i = buf.indexOf("\n\n")) >= 0) {
        const frame = buf.slice(0, i); buf = buf.slice(i + 2);
        const line = frame.split("\n").find(l => l.startsWith("data: "));
        if (line) { try { onData(JSON.parse(line.slice(6))); } catch {} }
      }
    }
  }

  /** POST that answers with an SSE stream (agent runs, approval decisions). */
  async function stream(path: string, body: unknown, onData: SseHandler, signal?: AbortSignal) {
    const res = await fetch(base + path, { method: "POST", headers: headers(), body: JSON.stringify(body), signal });
    if (!res.ok) await fail(res);
    await readSse(res, onData);
  }

  /** Long-lived bridge-event subscription with auto-reconnect and Last-Event-ID replay. */
  function openEvents(onEvent: SseHandler, onStatus?: (connected: boolean) => void): () => void {
    let stopped = false, last: number | null = null, ac: AbortController | null = null, delay = 1000;
    const loop = async () => {
      while (!stopped) {
        ac = new AbortController();
        try {
          const h = headers(false); if (last !== null) h["last-event-id"] = String(last);
          const res = await fetch(base + "/api/events/stream", { headers: h, signal: ac.signal });
          if (res.status === 401) { opts.onUnauthorized?.(); return; }
          if (!res.ok) throw new Error(String(res.status));
          delay = 1000; onStatus?.(true);
          await readSse(res, e => { if (typeof e?.seq === "number") last = e.seq; onEvent(e); });
        } catch { /* fall through to retry */ }
        if (stopped) return;
        onStatus?.(false);
        await new Promise(r => setTimeout(r, delay)); delay = Math.min(delay * 2, 15000);
      }
    };
    loop();
    return () => { stopped = true; ac?.abort(); };
  }

  /** GET a binary body (authenticated images can't use a plain <img src>). */
  async function blob(path: string): Promise<Blob> {
    const res = await fetch(base + path, { headers: headers(false) });
    if (!res.ok) await fail(res);
    return res.blob();
  }
  /** POST a binary body (e.g. a JPEG). */
  async function upload<T = any>(path: string, body: Blob, contentType = "image/jpeg"): Promise<T> {
    const h = headers(false); h["content-type"] = contentType;
    const res = await fetch(base + path, { method: "POST", headers: h, body });
    if (!res.ok) await fail(res);
    return res.json();
  }

  return { req, stream, openEvents, blob, upload, base };
}

/** Channel-keyed pub/sub fed by the server event stream (`_ch` on each event). */
export class Bridge {
  private subs = new Map<string, Set<SseHandler>>();
  subscribe(channel: string, cb: SseHandler) {
    if (!this.subs.has(channel)) this.subs.set(channel, new Set());
    this.subs.get(channel)!.add(cb);
    return () => { this.subs.get(channel)?.delete(cb); };
  }
  dispatch(e: any) { this.subs.get(e?._ch)?.forEach(cb => { try { cb(e); } catch (err) { console.error(err); } }); }
}
