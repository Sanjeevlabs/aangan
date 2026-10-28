import { requireCan, requireSession } from "@/lib/auth";
import { dbGetMember, dbListMembers, dbRemoveMember, dbUpdateMemberProfile } from "@/lib/db";
import { deleteDocsForMember } from "@/lib/family-docs";
import { can } from "@/lib/permissions";
import { UpdateMemberRequestSchema, type Member } from "@/lib/schemas";

// Editing and removing people in the tree, and assigning access roles.
// - A person without an account (added by a relative) can be edited or
//   removed by any member (not by a child).
// - A person with their own account edits themselves (Settings); only an
//   admin can remove them, and nobody removes themselves here (Leave family).
// - Access roles change only by an admin, and the family always keeps one.

async function target(req: Request, id: string): Promise<{ auth: { familyId: string; memberId: string }; member: Member; me: Member } | Response> {
  const auth = requireSession(req);
  if (auth instanceof Response) return auth;
  const [member, me] = await Promise.all([dbGetMember(id), dbGetMember(auth.memberId)]);
  if (!member || member.familyId !== auth.familyId || !me) return Response.json({ error: "unknown-member" }, { status: 404 });
  return { auth, member, me };
}

export async function PATCH(req: Request, { params }: { params: { id: string } }): Promise<Response> {
  const t = await target(req, params.id);
  if (t instanceof Response) return t;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "invalid-json" }, { status: 400 });
  }
  const parsed = UpdateMemberRequestSchema.safeParse(body);
  if (!parsed.success) return Response.json({ error: "invalid-member" }, { status: 400 });
  const { access, ...details } = parsed.data;
  const self = t.member.id === t.me.id;

  if (access !== undefined && access !== t.member.access) {
    if (!can(t.me, "roles.assign")) return Response.json({ error: "not-allowed", action: "roles.assign" }, { status: 403 });
    if (t.member.access === "admin") {
      const admins = (await dbListMembers(t.auth.familyId)).filter((m) => m.access === "admin");
      if (admins.length <= 1) return Response.json({ error: "last-admin" }, { status: 409 });
    }
  }
  if (Object.keys(details).length > 0 && !self) {
    if (t.member.email) return Response.json({ error: "has-account" }, { status: 403 });
    if (!can(t.me, "tree.edit")) return Response.json({ error: "not-allowed", action: "tree.edit" }, { status: 403 });
  }
  const patch = { ...details, ...(access !== undefined ? { access } : {}), ...(details.displayName && !t.member.email ? { firstName: details.displayName } : {}) };
  const member = await dbUpdateMemberProfile(t.member.id, patch);
  if (!member) return Response.json({ error: "update-failed" }, { status: 500 });
  return Response.json({ member });
}

export async function DELETE(req: Request, { params }: { params: { id: string } }): Promise<Response> {
  const t = await target(req, params.id);
  if (t instanceof Response) return t;
  if (t.member.id === t.me.id) return Response.json({ error: "use-leave-family" }, { status: 409 });
  const guard = await requireCan(t.auth, t.member.email ? "tree.remove-account" : "tree.remove");
  if (guard instanceof Response) return guard;
  if (t.member.access === "admin") {
    const admins = (await dbListMembers(t.auth.familyId)).filter((m) => m.access === "admin");
    if (admins.length <= 1) return Response.json({ error: "last-admin" }, { status: 409 });
  }
  const ok = await dbRemoveMember(t.member.id);
  if (!ok) return Response.json({ error: "remove-failed" }, { status: 500 });
  await deleteDocsForMember(t.auth.familyId, t.member.id);
  return Response.json({ removed: t.member.id });
}
