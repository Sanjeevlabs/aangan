import { CreateRelationshipRequestSchema } from "@/lib/schemas";
import { dbAddRelationship, dbGetMember, dbListMembers, dbListRelationships } from "@/lib/db";
import { requireMember, requireSession } from "@/lib/auth";

export async function GET(req: Request): Promise<Response> {
  const auth = requireSession(req);
  if (auth instanceof Response) return auth;
  return Response.json({ relationships: await dbListRelationships(auth.familyId) });
}

// Guided add: "Add Dadi as Dad's mother" — creates the new member + the edge
// in one validated call. Relation is the family's own word (data, not logic).
export async function POST(req: Request): Promise<Response> {
  const auth = requireSession(req);
  if (auth instanceof Response) return auth;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "invalid-json" }, { status: 400 });
  }
  const parsed = CreateRelationshipRequestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "invalid-relationship" }, { status: 400 });
  }
  const ownership = requireMember(auth, parsed.data.memberId);
  if (ownership) return ownership;
  const anchor = await dbGetMember(parsed.data.memberId);
  if (!anchor) return Response.json({ error: "unknown-member" }, { status: 404 });
  const names = new Set((await dbListMembers(auth.familyId)).map((m) => m.displayName.toLowerCase()));
  if (names.has(parsed.data.newMemberName.toLowerCase())) {
    return Response.json({ error: "duplicate-member" }, { status: 409 });
  }
  const { member, relationship } = await dbAddRelationship(parsed.data);
  return Response.json({ member, relationship }, { status: 201 });
}
