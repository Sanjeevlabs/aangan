import { z } from "zod";
import { dbGetMember, dbRemoveMember } from "@/lib/db";

const BodySchema = z.object({ memberId: z.string().min(1) });

// "Leave family": remove the member completely (member, edges, traces).
// Shared family cards are kept — the UI says exactly this.
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
  const ok = await dbRemoveMember(parsed.data.memberId);
  if (!ok) return Response.json({ error: "leave-failed" }, { status: 500 });
  return Response.json({ left: true });
}
