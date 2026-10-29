import { z } from "zod";
import { checkRateLimit, requireSession } from "@/lib/auth";
import { dbGetMember, dbListCards, dbListMembers, dbListRelationships } from "@/lib/db";
import { deleteDoc, getDoc, listDocs, newId, putDoc } from "@/lib/family-docs";
import { householdOf, households } from "@/lib/households";
import { PLACE_KINDS } from "@/lib/kinds";
import { canChange } from "@/lib/permissions";
import { DEMO_SHELF_CARDS } from "@/lib/demo";
import { suggestPlaces } from "@/lib/places";

// Around home. GET ?near=memberId → places + Muse's suggestions from the
// family's own words. POST → add · edit · delete · attach / detach a memory.

const id = z.string().min(1).max(80);
const Fields = {
  name: z.string().trim().min(1).max(60),
  kind: z.enum(PLACE_KINDS),
  note: z.string().trim().max(240).default(""),
  lat: z.number().min(-90).max(90).nullable().default(null),
  lng: z.number().min(-180).max(180).nullable().default(null),
  googlePlaceId: z.string().max(300).nullable().default(null),
};
const Body = z.discriminatedUnion("action", [
  z.object({ action: z.literal("add"), nearMemberId: id, ...Fields }),
  z.object({ action: z.literal("edit"), placeId: id, ...Fields }),
  z.object({ action: z.literal("delete"), placeId: id }),
  z.object({ action: z.literal("attach"), placeId: id, cardId: id }),
  z.object({ action: z.literal("detach"), placeId: id, cardId: id }),
]);

export async function GET(req: Request): Promise<Response> {
  const auth = await requireSession(req);
  if (auth instanceof Response) return auth;
  if (!checkRateLimit(auth, "/api/places")) return Response.json({ error: "rate-limited" }, { status: 429 });
  const near = new URL(req.url).searchParams.get("near");
  const places = await listDocs(auth.familyId, "place");
  if (!near) return Response.json({ places, suggestions: [] });
  const [members, rels, live, helpers] = await Promise.all([dbListMembers(auth.familyId), dbListRelationships(auth.familyId), dbListCards(auth.familyId), listDocs(auth.familyId, "helper")]);
  const cards = auth.familyId === "demo-family" ? [...live, ...DEMO_SHELF_CARDS.filter((d) => !live.some((c) => c.id === d.id))] : live;
  const home = householdOf(near, households(members, rels));
  const ids = new Set(home?.members.map((m) => m.id) ?? [near]);
  const here = places.filter((p) => ids.has(p.nearMemberId));
  const texts = [
    ...cards.filter((c) => c.authorId && ids.has(c.authorId)).map((c) => [c.caption, c.transcript].filter(Boolean).join(" ")),
    ...helpers.filter((h) => ids.has(h.forMemberId)).map((h) => h.note),
  ].filter(Boolean);
  const suggestions = await suggestPlaces(auth.familyId, texts, here.map((p) => p.name));
  return Response.json({ places: here, suggestions });
}

export async function POST(req: Request): Promise<Response> {
  const auth = await requireSession(req);
  if (auth instanceof Response) return auth;
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "invalid-place" }, { status: 400 });
  const body = parsed.data;
  const me = await dbGetMember(auth.memberId);
  if (!me || me.access === "child") return Response.json({ error: "not-allowed" }, { status: 403 });

  if (body.action === "add") {
    const members = await dbListMembers(auth.familyId);
    if (!members.some((m) => m.id === body.nearMemberId)) return Response.json({ error: "unknown-member" }, { status: 404 });
    const { action: _a, ...rest } = body;
    void _a;
    return Response.json({ place: await putDoc(auth.familyId, "place", { id: newId("place"), ...rest, cardIds: [], addedBy: auth.memberId, createdAt: new Date().toISOString() }) }, { status: 201 });
  }
  const place = await getDoc(auth.familyId, "place", body.placeId);
  if (!place) return Response.json({ error: "unknown-place" }, { status: 404 });
  switch (body.action) {
    case "edit": {
      const { action: _a, placeId: _p, ...rest } = body;
      void _a;
      void _p;
      return Response.json({ place: await putDoc(auth.familyId, "place", { ...place, ...rest }) });
    }
    case "delete":
      if (!canChange(me, place.addedBy)) return Response.json({ error: "not-yours" }, { status: 403 });
      await deleteDoc(auth.familyId, "place", place.id);
      return Response.json({ deleted: place.id });
    case "attach":
      return Response.json({ place: await putDoc(auth.familyId, "place", { ...place, cardIds: Array.from(new Set([...place.cardIds, body.cardId])) }) });
    case "detach":
      return Response.json({ place: await putDoc(auth.familyId, "place", { ...place, cardIds: place.cardIds.filter((c) => c !== body.cardId) }) });
  }
}
