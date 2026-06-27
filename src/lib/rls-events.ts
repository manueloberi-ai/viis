// Lightweight client-side recorder for RLS-blocked attempts (Postgres 42501).
// The DB audit log only captures successful writes, so we keep a small ring
// buffer here to surface "tentativi bloccati" in the UI.

export type RlsEvent = {
  id: string;
  table: string;
  action: "INSERT" | "UPDATE" | "DELETE" | "SELECT" | "UPSERT";
  itemId?: string | null;
  itemLabel?: string | null;
  message: string;
  at: string; // ISO timestamp
};

const KEY = "viis:rls-events";
const MAX = 25;
const CHANNEL = "viis:rls-events:changed";

function read(): RlsEvent[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as RlsEvent[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function write(events: RlsEvent[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, JSON.stringify(events.slice(0, MAX)));
  window.dispatchEvent(new CustomEvent(CHANNEL));
}

export function recordRlsEvent(input: Omit<RlsEvent, "id" | "at">) {
  const evt: RlsEvent = {
    ...input,
    id: crypto.randomUUID(),
    at: new Date().toISOString(),
  };
  write([evt, ...read()]);
  return evt;
}

export function listRlsEvents(): RlsEvent[] {
  return read();
}

export function clearRlsEvents() {
  write([]);
}

export function subscribeRlsEvents(cb: () => void) {
  if (typeof window === "undefined") return () => {};
  const handler = () => cb();
  window.addEventListener(CHANNEL, handler);
  window.addEventListener("storage", handler);
  return () => {
    window.removeEventListener(CHANNEL, handler);
    window.removeEventListener("storage", handler);
  };
}

export function isRlsError(error: unknown): boolean {
  const err = error as { code?: string; message?: string } | null;
  if (!err) return false;
  if (err.code === "42501") return true;
  return /row-level security|permission denied/i.test(err.message ?? "");
}
