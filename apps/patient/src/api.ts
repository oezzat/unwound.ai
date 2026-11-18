import { Bridge, EV, createApi } from "@wc/shared";

export const API_URL: string = (import.meta as any).env?.VITE_API_URL || "http://localhost:8787";
const KEY = "selma.token";

// sessionStorage: the token is dropped when the tab closes (safer default for health data on shared devices).
export const session = {
  get(): string | null { try { return sessionStorage.getItem(KEY); } catch { return null; } },
  set(t: string) { try { sessionStorage.setItem(KEY, t); } catch {} },
  clear() { try { sessionStorage.removeItem(KEY); } catch {} },
};

let onUnauthorized: () => void = () => {};
export const setOnUnauthorized = (fn: () => void) => { onUnauthorized = fn; };

export const api = createApi({ baseUrl: API_URL, getToken: () => session.get(), onUnauthorized: () => { session.clear(); onUnauthorized(); } });
export const bridge = new Bridge();

export async function login(email: string, password: string) {
  const r = await api.req("/api/auth/login", { email, password });
  if (r.user.role !== "patient") throw new Error("This app is for patients. Clinicians should sign in on the clinician site.");
  session.set(r.token);
  return r.user;
}

export class SelmaClient {
  threadId: string | null = null;
  async history(): Promise<{ role: string; text: string }[]> {
    const h = await api.req("/api/selma/history");
    this.threadId = h.threadId;
    return h.messages;
  }
  async run(text: string, onEvent: (e: any) => void) {
    const emit = (e: any) => {
      if (e.type === EV.RUN_STARTED && e.threadId) this.threadId = e.threadId;
      onEvent({ ts: Date.now(), ...e });
    };
    try { await api.stream("/api/selma/run", { text, threadId: this.threadId }, emit); }
    catch (e: any) {
      emit({ type: EV.RUN_ERROR, message: e?.status === 503 ? "Selma is unavailable right now. If you need help, contact your care team." : e?.message || "Request failed" });
      emit({ type: EV.RUN_FINISHED });
    }
  }
}
