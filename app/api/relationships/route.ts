import { CreateRelationshipRequestSchema } from "@/lib/schemas";
import { dbAddRelationship, dbGetMember, dbListMembers, dbListRelationships } from "@/lib/db";

export async function GET(): Promise<Response> {
  return Response.json({ relationships: await dbListRelationships() });
}

// Guided add: "Add Dadi as Dad's mother" — creates the new member + the edge
// in one validated call. Relation is the family's own word (data, not logic).
export async function POST(req: Request): Promise<Response> {
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
  const anchor = await dbGetMember(parsed.data.memberId);
  if (!anchor) return Response.json({ error: "unknown-member" }, { status: 404 });
  const names = new Set((await dbListMembers()).map((m) => m.displayName.toLowerCase()));
  if (names.has(parsed.data.newMemberName.toLowerCase())) {
    return Response.json({ error: "duplicate-member" }, { status: 409 });
  }
  const { member, relationship } = await dbAddRelationship(parsed.data);
  return Response.json({ member, relationship }, { status: 201 });
}
