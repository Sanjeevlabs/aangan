// Test-only session helper: mints a signed cookie with the vitest
// SESSION_SECRET ("test-session-secret"). Never used outside tests.
import { SESSION_COOKIE, signSession } from "@/lib/auth";

export function sessionCookie(memberId = "dadi", familyId = "demo-family"): string {
  const signed = signSession({ familyId, memberId }, undefined, "test-session-secret");
  if (!signed) throw new Error("test session unavailable");
  return `${SESSION_COOKIE}=${encodeURIComponent(signed)}`;
}

export function authedJson(url: string, body: unknown, memberId = "dadi"): Request {
  return new Request(url, {
    method: "POST",
    headers: { "content-type": "application/json", cookie: sessionCookie(memberId) },
    body: JSON.stringify(body),
  });
}

export function authedGet(url: string, memberId = "dadi"): Request {
  return new Request(url, { headers: { cookie: sessionCookie(memberId) } });
}
