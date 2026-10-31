import { z } from "zod";
import { requireCan, requireSession } from "@/lib/auth";
import { dbLinkMembers, dbListMembers, dbListRelationships } from "@/lib/db";
import { guardWrites } from "@/lib/api-guard";

// Link two people who are already in the family ("Papa is Maa's husband").
async function postHandler(req: Request): Promise<Response> {
  const auth = await requireSession(req);
  if (auth instanceof Response) return auth;
  const allowed = await requireCan(auth, "tree.add");
  if (allowed instanceof Response) return allowed;
  const parsed = z.object({ memberId: z.string().min(1), relationMemberId: z.string().min(1), relation: z.string().trim().min(1).max(40) }).safeParse(await req.json().catch(() => null));
  if (!parsed.success || parsed.data.memberId === parsed.data.relationMemberId) return Response.json({ error: "invalid-link" }, { status: 400 });
  const ids = new Set((await dbListMembers(auth.familyId)).map((m) => m.id));
  if (!ids.has(parsed.data.memberId) || !ids.has(parsed.data.relationMemberId)) return Response.json({ error: "unknown-member" }, { status: 404 });
  const exists = (await dbListRelationships(auth.familyId)).some(
    (r) => (r.memberId === parsed.data.memberId && r.relationMemberId === parsed.data.relationMemberId) || (r.memberId === parsed.data.relationMemberId && r.relationMemberId === parsed.data.memberId),
  );
  if (exists) return Response.json({ error: "already-linked" }, { status: 409 });
  const relationship = await dbLinkMembers({ familyId: auth.familyId, ...parsed.data });
  return Response.json({ relationship }, { status: 201 });
}

export const POST = guardWrites(postHandler);
