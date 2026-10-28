import { requireSession } from "@/lib/auth";
import { dbGetMember, dbRemoveMember, dbUpdateMemberProfile } from "@/lib/db";
import { deleteDocsForMember } from "@/lib/family-docs";
import { UpdateMemberRequestSchema, type Member } from "@/lib/schemas";

// Editing and removing people in the tree.
// - Anyone in the family may edit or remove a person who has no account yet
//   (someone added to the tree by a relative).
// - A person with their own account edits themselves (Settings) and leaves
//   on their own (Settings → Leave family). Nobody removes another account.

async function target(req: Request, id: string): Promise<{ auth: { familyId: string; memberId: string }; member: Member } | Response> {
  const auth = requireSession(req);
  if (auth instanceof Response) return auth;
  const member = await dbGetMember(id);
  if (!member || member.familyId !== auth.familyId) return Response.json({ error: "unknown-member" }, { status: 404 });
  return { auth, member };
}

export async function PATCH(req: Request, { params }: { params: { id: string } }): Promise<Response> {
  const t = await target(req, params.id);
  if (t instanceof Response) return t;
  if (t.member.email && t.member.id !== t.auth.memberId) return Response.json({ error: "has-account" }, { status: 403 });
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "invalid-json" }, { status: 400 });
  }
  const parsed = UpdateMemberRequestSchema.safeParse(body);
  if (!parsed.success) return Response.json({ error: "invalid-member" }, { status: 400 });
  const patch = { ...parsed.data, ...(parsed.data.displayName && !t.member.email ? { firstName: parsed.data.displayName } : {}) };
  const member = await dbUpdateMemberProfile(t.member.id, patch);
  if (!member) return Response.json({ error: "update-failed" }, { status: 500 });
  return Response.json({ member });
}

export async function DELETE(req: Request, { params }: { params: { id: string } }): Promise<Response> {
  const t = await target(req, params.id);
  if (t instanceof Response) return t;
  if (t.member.id === t.auth.memberId) return Response.json({ error: "use-leave-family" }, { status: 409 });
  if (t.member.email) return Response.json({ error: "has-account" }, { status: 403 });
  const ok = await dbRemoveMember(t.member.id);
  if (!ok) return Response.json({ error: "remove-failed" }, { status: 500 });
  await deleteDocsForMember(t.auth.familyId, t.member.id);
  return Response.json({ removed: t.member.id });
}
