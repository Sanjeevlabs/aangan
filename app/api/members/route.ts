import { DEMO_FAMILY } from "@/lib/family";
import { dbGetFamilyName, dbListMembers } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { can } from "@/lib/permissions";
import type { Member } from "@/lib/schemas";

// The family's people. Each person's email stays theirs: others only learn
// that they have an account. The cross-family personId never leaves the server.
function forViewer(m: Member, viewerId: string): Member {
  return { ...m, email: m.id === viewerId ? m.email : m.email ? "account" : null, personId: null };
}

export async function GET(req: Request): Promise<Response> {
  const auth = await requireSession(req);
  if (auth instanceof Response) return auth;
  const [all, name] = await Promise.all([dbListMembers(auth.familyId, { includePending: true }), dbGetFamilyName(auth.familyId)]);
  const members = all.filter((m) => m.status !== "pending");
  // Waiting to join: only the people who can let them in see them.
  const me = members.find((m) => m.id === auth.memberId);
  const pending = can(me, "members.approve") ? all.filter((m) => m.status === "pending").map((m) => forViewer(m, auth.memberId)) : [];
  const clean = name.replace(/^the\s+/i, "").replace(/\s+family$/i, "");
  return Response.json({ members: members.map((m) => forViewer(m, auth.memberId)), pending, family: { ...DEMO_FAMILY, id: auth.familyId, name: clean || (auth.familyId === "demo-family" ? DEMO_FAMILY.name : "Family") } });
}
