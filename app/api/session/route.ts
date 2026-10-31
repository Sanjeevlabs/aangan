import { z } from "zod";
import { DEMO_INVITE_CODE, clearSessionCookieHeader, isDemoFamily, sessionCookieHeader, sessionFromRequest, signSession } from "@/lib/auth";
import { dbFindInvite, dbGetMember, dbListMembers } from "@/lib/db";
import { isAdmin, isClaimable } from "@/lib/permissions";
import { hostOf } from "@/lib/roles";
import { allowAuthAttempt } from "@/lib/otp";

const ExchangeSchema = z.object({
  inviteCode: z.string().min(1).max(64),
  memberId: z.string().min(1).max(64),
});

// Invite code -> httpOnly signed session cookie. The code must be a live,
// unexpired family invite (Privacy page) for the member's family — or the
// documented AANGAN-DEMO bootstrap code for the synthetic demo families.
// Members with their own account, and admins, must use the email code.
export async function POST(req: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "invalid-json" }, { status: 400 });
  }
  // Slow down guessing: per caller address and per target member.
  const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || "local";
  const claimed = (body as { memberId?: unknown } | null)?.memberId;
  if (!allowAuthAttempt(`session:${ip}`, 20) || (typeof claimed === "string" && !allowAuthAttempt(`session-member:${claimed}`, 10))) return Response.json({ error: "too-many-attempts" }, { status: 429 });
  const parsed = ExchangeSchema.safeParse(body);
  if (!parsed.success) return Response.json({ error: "invalid-session" }, { status: 400 });
  const code = parsed.data.inviteCode.trim();
  const member = await dbGetMember(parsed.data.memberId);
  if (!member) return Response.json({ error: "unknown-member" }, { status: 404 });

  let ok = false;
  if (code === DEMO_INVITE_CODE && isDemoFamily(member.familyId)) {
    ok = true;
  } else if (member.email || isAdmin(member)) {
    // An invite code lets someone take a place the family made for them. It
    // never opens a person who has their own account, or an admin: they sign
    // in with their email code.
    return Response.json({ error: "sign-in-with-email" }, { status: 403 });
  } else if (!isClaimable(member)) {
    // Same rule as joining by email: a code opens only a grown-up's open
    // place, never a child's or teen's profile.
    return Response.json({ error: "not-claimable" }, { status: 403 });
  } else {
    // Codes are stored upper-case; typing them any case works.
    const invite = await dbFindInvite(code);
    ok = Boolean(invite && invite.familyId === member.familyId);
  }
  if (!ok) return Response.json({ error: "invalid-invite" }, { status: 403 });

  const signed = signSession({ familyId: member.familyId, memberId: member.id });
  if (!signed) return Response.json({ error: "session-unavailable" }, { status: 500 });
  return Response.json(
    { familyId: member.familyId, memberId: member.id },
    { headers: { "set-cookie": sessionCookieHeader(signed) } },
  );
}

// Current session (who am I). The one route a joiner who is still waiting
// for an admin can use: it says whom they're waiting for (a first name only).
export async function GET(req: Request): Promise<Response> {
  const session = sessionFromRequest(req);
  if (!session) return Response.json({ error: "unauthorized" }, { status: 401 });
  const me = await dbGetMember(session.memberId);
  if (!me || me.familyId !== session.familyId) return Response.json({ error: "unauthorized" }, { status: 401 });
  if (me.status !== "pending") return Response.json({ familyId: session.familyId, memberId: session.memberId, status: "active" });
  const host = hostOf(await dbListMembers(session.familyId));
  return Response.json({ familyId: session.familyId, memberId: session.memberId, status: "pending", waitingFor: host ? host.firstName : null });
}

// Log out: clear the cookie.
export async function DELETE(): Promise<Response> {
  return Response.json({ ok: true }, { headers: { "set-cookie": clearSessionCookieHeader() } });
}
