import { z } from "zod";
import { requireSession, sessionCookieHeader, signSession } from "@/lib/auth";
import { dbAddMember, dbCreateFamily, dbCreateInvite, dbGetFamilyName, dbGetMember, dbLinkMembers, dbListMembers, dbListRelationships, dbListSides, dbUpdateMemberProfile } from "@/lib/db";
import { allowAuthAttempt } from "@/lib/otp";
import type { Member } from "@/lib/schemas";

// Two courtyards, one door. Each family keeps its own Aangan; a married couple
// and their children belong to both. Nothing crosses between Aangans: this
// route only lists the Aangans *you* are in and moves your session between them.
//
// GET  → your sides
// POST → switch {familyId} · create {familyName, bring[]} ("Add my family")

const id = z.string().min(1).max(80);
const Body = z.discriminatedUnion("action", [
  z.object({ action: z.literal("switch"), familyId: id }),
  z.object({ action: z.literal("create"), familyName: z.string().trim().min(1).max(40), bring: z.array(id).max(8).default([]) }),
]);

const MAX_SIDES = 4;

async function sidesOf(me: Member) {
  const rows = await dbListSides(me);
  return Promise.all(
    rows.map(async (m) => ({ familyId: m.familyId, memberId: m.id, name: (await dbGetFamilyName(m.familyId)) || "Family", people: (await dbListMembers(m.familyId)).length })),
  );
}

function newPersonId(): string {
  return `p-${crypto.randomUUID().slice(0, 16)}`;
}

export async function GET(req: Request): Promise<Response> {
  const auth = requireSession(req);
  if (auth instanceof Response) return auth;
  const me = await dbGetMember(auth.memberId);
  if (!me || me.familyId !== auth.familyId) return Response.json({ error: "unknown-member" }, { status: 404 });
  return Response.json({ current: auth.familyId, sides: await sidesOf(me) });
}

export async function POST(req: Request): Promise<Response> {
  const auth = requireSession(req);
  if (auth instanceof Response) return auth;
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "invalid-sides" }, { status: 400 });
  const body = parsed.data;
  const me = await dbGetMember(auth.memberId);
  if (!me || me.familyId !== auth.familyId) return Response.json({ error: "unknown-member" }, { status: 404 });

  if (body.action === "switch") {
    // Only to an Aangan where this same person already has a place.
    const target = (await dbListSides(me)).find((m) => m.familyId === body.familyId);
    if (!target) return Response.json({ error: "not-your-family" }, { status: 403 });
    const signed = signSession({ familyId: target.familyId, memberId: target.id });
    if (!signed) return Response.json({ error: "session-unavailable" }, { status: 500 });
    return Response.json({ familyId: target.familyId, memberId: target.id }, { headers: { "set-cookie": sessionCookieHeader(signed) } });
  }

  // "Add my family": a new Aangan for my parents' side, with my home inside it.
  if (me.access === "child" || me.role === "child") return Response.json({ error: "grown-ups-only" }, { status: 403 });
  if (!allowAuthAttempt(`side-create:${me.id}`, 3, 24 * 3_600_000)) return Response.json({ error: "too-many" }, { status: 429 });
  if ((await dbListSides(me)).length >= MAX_SIDES) return Response.json({ error: "too-many-sides" }, { status: 409 });

  // Only my own home comes with me: my spouse and my children, by the family's own tree.
  const rels = await dbListRelationships(auth.familyId);
  const members = await dbListMembers(auth.familyId);
  const mine = new Set<string>();
  for (const r of rels) {
    const other = r.memberId === me.id ? r.relationMemberId : r.relationMemberId === me.id ? r.memberId : null;
    if (!other) continue;
    const kind = r.memberId === me.id ? r.canonicalKind : r.canonicalKind === "parent" ? "child" : r.canonicalKind === "child" ? "parent" : r.canonicalKind;
    if (kind === "spouse" || kind === "child") mine.add(other);
  }
  if (!body.bring.every((b) => mine.has(b))) return Response.json({ error: "only-your-home" }, { status: 400 });

  const familyId = await dbCreateFamily(body.familyName);
  const copy = async (m: Member, access: Member["access"]): Promise<Member> => {
    let personId = m.personId;
    if (!personId) {
      personId = newPersonId();
      await dbUpdateMemberProfile(m.id, { personId });
    }
    return dbAddMember({
      familyId,
      firstName: m.firstName,
      displayName: m.displayName,
      role: m.role,
      lang: m.lang,
      displayLang: m.displayLang,
      tz: m.tz,
      birthday: m.birthday,
      photoRef: m.photoRef,
      // Only my own email travels with me: it's how I sign in to both sides.
      email: m.id === me.id ? m.email : null,
      access,
      personId,
    });
  };
  const self = await copy(me, "admin");
  const brought = new Map<string, Member>();
  for (const b of body.bring) {
    const src = members.find((m) => m.id === b);
    if (src) brought.set(src.id, await copy(src, src.access === "child" ? "child" : "member"));
  }
  // Rebuild the relationships inside my home, nothing else.
  for (const [srcId, row] of Array.from(brought)) {
    const r = rels.find((x) => (x.memberId === me.id && x.relationMemberId === srcId) || (x.relationMemberId === me.id && x.memberId === srcId));
    if (!r) continue;
    const asMine = r.memberId === me.id;
    await dbLinkMembers({ familyId, memberId: asMine ? self.id : row.id, relationMemberId: asMine ? row.id : self.id, relation: r.relation });
  }
  const invite = await dbCreateInvite(familyId);
  const signed = signSession({ familyId, memberId: self.id });
  if (!signed) return Response.json({ error: "session-unavailable" }, { status: 500 });
  return Response.json({ familyId, memberId: self.id, invite }, { headers: { "set-cookie": sessionCookieHeader(signed) } });
}
