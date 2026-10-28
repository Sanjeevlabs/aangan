import { z } from "zod";
import { sessionCookieHeader, sessionFromRequest, signSession } from "@/lib/auth";
import { dbGetMember } from "@/lib/db";

const SwitchSchema = z.object({ memberId: z.string().min(1).max(64) });

// Viewer switcher: mint a fresh cookie for another member of the SAME family,
// keeping the existing valid session as proof. No invite code needed twice.
export async function POST(req: Request): Promise<Response> {
  const session = sessionFromRequest(req);
  if (!session) return Response.json({ error: "unauthorized" }, { status: 401 });
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "invalid-json" }, { status: 400 });
  }
  const parsed = SwitchSchema.safeParse(body);
  if (!parsed.success) return Response.json({ error: "invalid-switch" }, { status: 400 });
  const member = await dbGetMember(parsed.data.memberId);
  if (!member || member.familyId !== session.familyId) {
    return Response.json({ error: "unknown-member" }, { status: 404 });
  }
  const signed = signSession({ familyId: member.familyId, memberId: member.id });
  if (!signed) return Response.json({ error: "session-unavailable" }, { status: 500 });
  return Response.json(
    { familyId: member.familyId, memberId: member.id },
    { headers: { "set-cookie": sessionCookieHeader(signed) } },
  );
}
