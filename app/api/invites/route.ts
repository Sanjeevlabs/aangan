import { z } from "zod";
import { dbCreateInvite, dbListInvites } from "@/lib/db";

export async function GET(): Promise<Response> {
  const invites = (await dbListInvites()).filter((i) => new Date(i.expiresAt).getTime() > Date.now());
  return Response.json({ invites });
}

// Expiring invite codes (7 days). Service-role only; no auth flow in V1.
export async function POST(req: Request): Promise<Response> {
  const body = await req.json().catch(() => ({}));
  const parsed = z.object({ familyId: z.string().default("demo-family") }).safeParse(body);
  if (!parsed.success) return Response.json({ error: "invalid-invite" }, { status: 400 });
  const invite = await dbCreateInvite(parsed.data.familyId);
  return Response.json({ invite }, { status: 201 });
}
