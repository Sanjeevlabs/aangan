// Email one-time codes for sign-in. Passwordless: Supabase Auth sends a
// 6-digit code (the email template must include {{ .Token }}). Mock mode
// accepts 000000 and sends nothing, so demos and tests never need email.
import { createClient } from "@supabase/supabase-js";

export const MOCK_OTP = "000000";

function authClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

/**
 * "mock" only when MOCK=true is set on purpose (demos, tests). A missing model
 * key never opens sign-in: without Supabase Auth in production, codes fail.
 */
function otpMode(): "live" | "mock" | "off" {
  if (process.env.MOCK === "true") return "mock";
  if (authClient()) return "live";
  return process.env.NODE_ENV === "production" ? "off" : "mock";
}
function otpLive(): boolean {
  return otpMode() === "live";
}

export async function sendCode(email: string): Promise<{ ok: boolean; mock: boolean }> {
  if (otpMode() === "off") return { ok: false, mock: false };
  if (!otpLive()) return { ok: true, mock: true };
  const sb = authClient();
  if (!sb) return { ok: false, mock: false };
  const { error } = await sb.auth.signInWithOtp({ email, options: { shouldCreateUser: true } });
  return { ok: !error, mock: false };
}

export async function verifyCode(email: string, code: string): Promise<boolean> {
  if (otpMode() === "off") return false;
  if (!otpLive()) return code === MOCK_OTP;
  const sb = authClient();
  if (!sb) return false;
  const { error } = await sb.auth.verifyOtp({ email, token: code, type: "email" });
  return !error;
}

// Small in-process limiter for unauthenticated auth endpoints (per key).
const hits = new Map<string, number[]>();
export function allowAuthAttempt(key: string, max = 5, windowMs = 10 * 60_000, now = Date.now()): boolean {
  const recent = (hits.get(key) ?? []).filter((t) => t > now - windowMs);
  if (recent.length >= max) {
    hits.set(key, recent);
    return false;
  }
  recent.push(now);
  hits.set(key, recent);
  return true;
}

export function clearAuthAttempts(): void {
  hits.clear();
}
