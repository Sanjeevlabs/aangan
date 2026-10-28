import { z } from "zod";
import { dbDeleteMemberTraces, dbGetMember } from "@/lib/db";
import { requireMember, requireSession } from "@/lib/auth";

const BodySchema = z.object({ memberId: z.string().min(1) });

// "Remove my memories": delete the member's attributable traces (wishes,
// reactions, plays, daily roles). Cards stay in the shared family pool —
// the UI says exactly this.
export async function DELETE(req: Request): Promise<Response> {
  const auth = requireSession(req);
  if (auth instanceof Response) return auth;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "invalid-json" }, { status: 400 });
  }
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) return Response.json({ error: "invalid-request" }, { status: 400 });
  const ownership = requireMember(auth, parsed.data.memberId);
  if (ownership) return ownership;
  if (!(await dbGetMember(parsed.data.memberId))) {
    return Response.json({ error: "unknown-member" }, { status: 404 });
  }
  const deleted = await dbDeleteMemberTraces(parsed.data.memberId);
  return Response.json({ deleted });
}
