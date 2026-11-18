import { Bridge, EV, createApi } from "@wc/shared";

export const API_URL: string = (import.meta as any).env?.VITE_API_URL || "http://localhost:8787";
const KEY = "augi.token";

// sessionStorage (not localStorage): the token dies with the tab, which is the safer default for PHI apps.
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
  if (r.user.role === "patient") throw new Error("This app is for care teams and administrators. Patients should use the Selma app.");
  session.set(r.token);
  return r.user;
}

/** Client for the server-side Selma agent. Same shape the UI used with the old in-browser agent. */
export class AugiClient {
  private threads = new Map<string, string>();
  async run(text: string, onEvent: (e: any) => void, patientId: string | null = null) {
    const key = patientId || "_global";
    const emit = (e: any) => {
      if (e.type === EV.RUN_STARTED && e.threadId) this.threads.set(key, e.threadId);
      onEvent({ ts: Date.now(), ...e });
    };
    try {
      await api.stream("/api/augi/run", { text, patientId, threadId: this.threads.get(key) ?? null }, emit);
    } catch (e: any) {
      emit({ type: EV.RUN_ERROR, message: e?.status === 503 ? "Selma isn't available right now. Please try again later or contact your administrator." : e?.message || "Request failed" });
      emit({ type: EV.RUN_FINISHED });
    }
  }
  async decide(d: { interruptId: string; approved: boolean; finalValues?: Record<string, any>; note?: string }, onEvent: (e: any) => void) {
    const emit = (e: any) => onEvent({ ts: Date.now(), ...e });
    try {
      await api.stream(`/api/augi/actions/${d.interruptId}/decision`, { approved: d.approved, finalValues: d.finalValues, note: d.note }, emit);
    } catch (e: any) {
      emit({ type: EV.RUN_ERROR, message: e?.status === 409 ? "That action was already decided." : e?.message || "Decision failed" });
      emit({ type: EV.RUN_FINISHED });
    }
  }
}
