import { z } from "zod";
import { sessionCookieHeader, signSession } from "@/lib/auth";
import { dbAddMember, dbCreateFamily, dbFindMemberByEmail, dbListInvites } from "@/lib/db";
import { allowAuthAttempt, verifyCode } from "@/lib/otp";

const Name = z.string().trim().min(1).max(40);
const VerifySchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  code: z.string().trim().regex(/^\d{6}$/),
  tz: z.string().max(64).default("UTC"),
  birthday: z.string().regex(/^(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/).optional(),
  intent: z.discriminatedUnion("type", [
    z.object({ type: z.literal("signin") }),
    z.object({ type: z.literal("create"), familyName: Name, firstName: Name, callName: Name.optional() }),
    z.object({ type: z.literal("join"), inviteCode: z.string().trim().min(4).max(64), firstName: Name, callName: Name.optional() }),
  ]),
});

function validTz(tz: string): string {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return tz;
  } catch {
    return "UTC";
  }
}

// Step 2: verify the code and, in the same request, sign in, create a family,
// or join one. Verification and account changes never happen separately, so a
// code can't be replayed into a different action.
export async function POST(req: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "invalid-json" }, { status: 400 });
  }
  const parsed = VerifySchema.safeParse(body);
  if (!parsed.success) return Response.json({ error: "invalid-request" }, { status: 400 });
  const { email, code, intent } = parsed.data;
  if (!allowAuthAttempt(`verify:${email}`, 8)) return Response.json({ error: "too-many-attempts" }, { status: 429 });
  if (!(await verifyCode(email, code))) return Response.json({ error: "wrong-code" }, { status: 401 });

  const existing = await dbFindMemberByEmail(email);
  let familyId: string;
  let memberId: string;

  if (intent.type === "signin") {
    if (!existing) return Response.json({ error: "no-family" }, { status: 404 });
    familyId = existing.familyId;
    memberId = existing.id;
  } else {
    if (existing) return Response.json({ error: "already-member" }, { status: 409 });
    if (intent.type === "create") {
      familyId = await dbCreateFamily(intent.familyName);
    } else {
      const now = Date.now();
      const invite = (await dbListInvites()).find((i) => i.code.toUpperCase() === intent.inviteCode.toUpperCase() && new Date(i.expiresAt).getTime() > now);
      if (!invite) return Response.json({ error: "invalid-invite" }, { status: 403 });
      familyId = invite.familyId;
    }
    const member = await dbAddMember({
      familyId,
      firstName: intent.firstName,
      displayName: intent.callName || intent.firstName,
      role: "adult",
      lang: "en",
      displayLang: "en",
      tz: validTz(parsed.data.tz),
      birthday: parsed.data.birthday ?? "01-01",
      email,
    });
    memberId = member.id;
  }

  const signed = signSession({ familyId, memberId });
  if (!signed) return Response.json({ error: "session-unavailable" }, { status: 500 });
  return Response.json({ familyId, memberId }, { headers: { "set-cookie": sessionCookieHeader(signed) } });
}
