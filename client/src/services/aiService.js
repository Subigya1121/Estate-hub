import { supabase } from "./supabase.js";

// Client for the EstateHub AI service (the separate Python service in /ai-service).
// The AI provider key lives only on that service. This file only knows its public URL.
const BASE = (import.meta.env.VITE_AI_SERVICE_URL || "").replace(/\/+$/, "");

// When the URL is not set, every AI feature stays hidden and the site behaves exactly as before.
export const isAiConfigured = Boolean(BASE);

export class AiError extends Error {
  constructor(code, message, retryAfter) {
    super(message);
    this.code = code;
    this.retryAfter = retryAfter;
  }
}

const FRIENDLY = {
  network: "We couldn't reach the AI assistant. Please try again in a moment.",
  timeout: "The AI assistant took too long to answer. Please try again.",
  unauthorized: "Please sign in again to use this feature.",
};

async function post(path, body, { auth = false, timeoutMs = 30000 } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (auth) {
    // The signed-in user's session token proves who is asking. No other credential is ever sent.
    const { data } = supabase ? await supabase.auth.getSession() : { data: {} };
    const token = data.session?.access_token;
    if (!token) throw new AiError("unauthorized", FRIENDLY.unauthorized);
    headers.Authorization = `Bearer ${token}`;
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let res;
  try {
    res = await fetch(`${BASE}${path}`, { method: "POST", headers, body: JSON.stringify(body), signal: controller.signal });
  } catch (err) {
    const code = err?.name === "AbortError" ? "timeout" : "network";
    throw new AiError(code, FRIENDLY[code]);
  } finally {
    clearTimeout(timer);
  }
  let data = null;
  try {
    data = await res.json();
  } catch {
    /* non-JSON error body */
  }
  if (!res.ok) {
    const code = data?.error?.code || "error";
    throw new AiError(code, data?.error?.message || "The AI assistant couldn't help right now. Please try again.", Number(res.headers.get("retry-after")) || undefined);
  }
  return data;
}

// Draft listing text from the owner's facts. Requires a signed-in user.
export const generateDescription = (facts) => post("/v1/describe", facts, { auth: true });
// Natural-language query -> { filters, unsupported }
export const parseSearch = (query) => post("/v1/search/parse", { query });
// Conversation -> { reply, followUpQuestion, ready, filters, unsupported }
export const askConcierge = (messages) => post("/v1/concierge", { messages });
