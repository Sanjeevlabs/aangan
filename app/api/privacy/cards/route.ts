import { z } from "zod";
import { dbDeleteMemberTraces, dbGetMember } from "@/lib/db";

const BodySchema = z.object({ memberId: z.string().min(1) });

// "Remove my memories": delete the member's attributable traces (wishes,
// reactions, plays, daily roles). Cards stay in the shared family pool —
// the UI says exactly this.
export async function DELETE(req: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "invalid-json" }, { status: 400 });
  }
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) return Response.json({ error: "invalid-request" }, { status: 400 });
  if (!(await dbGetMember(parsed.data.memberId))) {
    return Response.json({ error: "unknown-member" }, { status: 404 });
  }
  const deleted = await dbDeleteMemberTraces(parsed.data.memberId);
  return Response.json({ deleted });
}
