import { z } from "zod";
import { dbCreateInvite, dbListInvites, dbRevokeInvite } from "@/lib/db";
import { requireCan, requireSession } from "@/lib/auth";

export async function GET(req: Request): Promise<Response> {
  const auth = await requireSession(req);
  if (auth instanceof Response) return auth;
  const invites = (await dbListInvites()).filter(
    (i) => i.familyId === auth.familyId && new Date(i.expiresAt).getTime() > Date.now(),
  );
  return Response.json({ invites });
}

// Expiring invite codes (7 days). Session members mint codes for their own
// family; the code is exchanged for a session at /api/session.
export async function POST(req: Request): Promise<Response> {
  const auth = await requireSession(req);
  if (auth instanceof Response) return auth;
  const allowed = await requireCan(auth, "invite.create");
  if (allowed instanceof Response) return allowed;
  const body = await req.json().catch(() => ({}));
  const parsed = z.object({ familyId: z.string().optional() }).safeParse(body);
  if (!parsed.success) return Response.json({ error: "invalid-invite" }, { status: 400 });
  if (parsed.data.familyId && parsed.data.familyId !== auth.familyId) return Response.json({ error: "forbidden-family" }, { status: 403 });
  const invite = await dbCreateInvite(auth.familyId);
  return Response.json({ invite }, { status: 201 });
}

// Revoke a code before it expires (admins).
export async function DELETE(req: Request): Promise<Response> {
  const auth = await requireSession(req);
  if (auth instanceof Response) return auth;
  const allowed = await requireCan(auth, "invite.revoke");
  if (allowed instanceof Response) return allowed;
  const parsed = z.object({ code: z.string().trim().min(4).max(64) }).safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "invalid-invite" }, { status: 400 });
  const ok = await dbRevokeInvite(parsed.data.code, auth.familyId);
  return ok ? Response.json({ revoked: parsed.data.code }) : Response.json({ error: "unknown-invite" }, { status: 404 });
}
