import { z } from "zod";
import { requireSession } from "@/lib/auth";
import { dbListMembers } from "@/lib/db";
import { deleteDoc, getDoc, listDocs, newId, putDoc } from "@/lib/family-docs";
import { SITTING_REASONS } from "@/lib/kinds";

// Sit together: planned sittings with a reason, and "come sit" knocks.
const Body = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("sit"),
    reason: z.enum(SITTING_REASONS),
    title: z.string().trim().min(2).max(80),
    startsAt: z.string().datetime(),
    invites: z.array(z.string().min(1)).max(30).default([]),
    recipeId: z.string().nullable().optional(),
    note: z.string().trim().max(200).default(""),
  }),
  z.object({ action: z.literal("cancel"), sittingId: z.string().min(1) }),
  z.object({ action: z.literal("knock"), minutes: z.number().int().min(15).max(180).default(45), note: z.string().trim().max(80).default("") }),
  z.object({ action: z.literal("unknock") }),
]);

export async function GET(req: Request): Promise<Response> {
  const auth = requireSession(req);
  if (auth instanceof Response) return auth;
  const now = Date.now();
  const [sittings, knocks] = await Promise.all([listDocs(auth.familyId, "sitting"), listDocs(auth.familyId, "knock")]);
  return Response.json({
    // Keep sittings visible until 3 hours after they start (so "Join" works late).
    sittings: sittings.filter((s) => Date.parse(s.startsAt) > now - 3 * 3_600_000).sort((a, b) => a.startsAt.localeCompare(b.startsAt)),
    knocks: knocks.filter((k) => Date.parse(k.until) > now),
  });
}

export async function POST(req: Request): Promise<Response> {
  const auth = requireSession(req);
  if (auth instanceof Response) return auth;
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "invalid-sitting" }, { status: 400 });
  const body = parsed.data;
  const now = new Date();

  if (body.action === "sit") {
    if (Date.parse(body.startsAt) < now.getTime() - 5 * 60_000) return Response.json({ error: "in-the-past" }, { status: 400 });
    const family = new Set((await dbListMembers(auth.familyId)).map((m) => m.id));
    const invites = Array.from(new Set(body.invites.filter((id) => family.has(id) && id !== auth.memberId)));
    const sitting = await putDoc(auth.familyId, "sitting", { id: newId("sit"), reason: body.reason, title: body.title, hostId: auth.memberId, startsAt: new Date(body.startsAt).toISOString(), invites, recipeId: body.recipeId ?? null, note: body.note, keptCardId: null, createdAt: now.toISOString() });
    return Response.json({ sitting }, { status: 201 });
  }
  if (body.action === "cancel") {
    const s = await getDoc(auth.familyId, "sitting", body.sittingId);
    if (!s) return Response.json({ error: "unknown-sitting" }, { status: 404 });
    if (s.hostId !== auth.memberId) return Response.json({ error: "not-host" }, { status: 403 });
    await deleteDoc(auth.familyId, "sitting", s.id);
    return Response.json({ cancelled: s.id });
  }
  // One open knock per person: a new one replaces the old.
  const mine = (await listDocs(auth.familyId, "knock")).filter((k) => k.memberId === auth.memberId);
  for (const k of mine) await deleteDoc(auth.familyId, "knock", k.id);
  if (body.action === "unknock") return Response.json({ closed: mine.length });
  const knock = await putDoc(auth.familyId, "knock", { id: newId("knock"), memberId: auth.memberId, note: body.note, at: now.toISOString(), until: new Date(now.getTime() + body.minutes * 60_000).toISOString() });
  return Response.json({ knock }, { status: 201 });
}
