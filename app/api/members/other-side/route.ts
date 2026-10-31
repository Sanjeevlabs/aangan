import { z } from "zod";
import { isDemoFamily, requireCan, requireSession } from "@/lib/auth";
import { dbAddRelationship, dbLinkMembers, dbListMembers, dbUpdateMemberProfile } from "@/lib/db";
import { allowAuthAttempt } from "@/lib/otp";
import type { Member } from "@/lib/schemas";

// Onboarding, "Whose window is this?": the person who started the family adds
// the home on the other side of the window. No roles are assumed: one parent,
// two, a guardian, grown-up children — whoever it is, by the name the family
// calls them, and the city they live in. They join later with an invite code
// and take the place made for them (claimMemberId at /api/auth/verify).

const Person = z.object({
  callName: z.string().trim().min(1).max(40),
  city: z.string().trim().max(60).default(""),
});
const Body = z.object({
  /** How they're related to me: my parents, my children, or other family (a guardian, an aunt…). */
  they: z.enum(["parents", "children", "other"]),
  people: z.array(Person).min(1).max(6),
  /** Their time zone, when it differs from mine. */
  tz: z.string().max(64).optional(),
});

const RELATION: Record<z.infer<typeof Body>["they"], string> = { parents: "parent", children: "child", other: "family" };

function validTz(tz: string | undefined, fallback: string): string {
  if (!tz) return fallback;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return tz;
  } catch {
    return fallback;
  }
}

export async function POST(req: Request): Promise<Response> {
  const auth = await requireSession(req);
  if (auth instanceof Response) return auth;
  const me = await requireCan(auth, "tree.add");
  if (me instanceof Response) return me;
  if (isDemoFamily(auth.familyId)) return Response.json({ error: "not-in-demo" }, { status: 403 });
  if (!allowAuthAttempt(`other-side:${me.id}`, 6, 3_600_000)) return Response.json({ error: "too-many" }, { status: 429 });
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "invalid-people" }, { status: 400 });
  const { they, people } = parsed.data;
  const tz = validTz(parsed.data.tz, me.tz);

  const taken = new Set((await dbListMembers(auth.familyId)).map((m) => m.displayName.toLowerCase()));
  const fresh = people.filter((p) => !taken.has(p.callName.toLowerCase()));
  if (fresh.length === 0) return Response.json({ error: "duplicate-member" }, { status: 409 });

  // Their generation follows how they're related to me; mine follows theirs.
  const role: Member["role"] = they === "children" ? "adult" : "elder";
  if (they === "children" && me.role !== "elder") await dbUpdateMemberProfile(me.id, { role: "elder" });

  const added: Member[] = [];
  for (const p of fresh) {
    const { member } = await dbAddRelationship({ familyId: auth.familyId, memberId: me.id, newMemberName: p.callName, newMemberRole: role, relation: RELATION[they], tz, anchorRole: me.role });
    added.push((p.city ? await dbUpdateMemberProfile(member.id, { city: p.city }) : member) ?? member);
  }
  // Two parents (or two people looking after me) share one home on the window.
  if (they !== "children" && added.length >= 2) await dbLinkMembers({ familyId: auth.familyId, memberId: added[0].id, relationMemberId: added[1].id, relation: "spouse" });

  return Response.json({ members: added.map((m) => ({ ...m, email: null, personId: null })) }, { status: 201 });
}
