import { z } from "zod";
import { dbCreateInvite, dbListInvites } from "@/lib/db";
import { requireSession } from "@/lib/auth";

export async function GET(req: Request): Promise<Response> {
  const auth = requireSession(req);
  if (auth instanceof Response) return auth;
  const invites = (await dbListInvites()).filter(
    (i) => i.familyId === auth.familyId && new Date(i.expiresAt).getTime() > Date.now(),
  );
  return Response.json({ invites });
}

// Expiring invite codes (7 days). Session members mint codes for their own
// family; the code is exchanged for a session at /api/session.
export async function POST(req: Request): Promise<Response> {
  const auth = requireSession(req);
  if (auth instanceof Response) return auth;
  const body = await req.json().catch(() => ({}));
  const parsed = z.object({ familyId: z.string().default("demo-family") }).safeParse(body);
  if (!parsed.success) return Response.json({ error: "invalid-invite" }, { status: 400 });
  if (parsed.data.familyId !== auth.familyId) return Response.json({ error: "forbidden-family" }, { status: 403 });
  const invite = await dbCreateInvite(parsed.data.familyId);
  return Response.json({ invite }, { status: 201 });
}
