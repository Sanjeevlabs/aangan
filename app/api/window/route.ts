import { z } from "zod";
import { checkRateLimit, requireSession } from "@/lib/auth";
import { dbListCards, dbListMembers } from "@/lib/db";
import { getDoc, putDoc } from "@/lib/family-docs";
import { composeWindow, photoRefFor, windowState } from "@/lib/window-server";
import { withDemoShelf } from "@/lib/demo";
import { WALLS } from "@/lib/kinds";

// The window (LITE): your view into the other home. Each person sets their
// own: a family photo, still or living. Muse composes the living motion.

export async function GET(req: Request): Promise<Response> {
  const auth = await requireSession(req);
  if (auth instanceof Response) return auth;
  if (!checkRateLimit(auth, "/api/window")) return Response.json({ error: "rate-limited" }, { status: 429 });
  return Response.json(await windowState(auth.familyId, auth.memberId));
}

const Choose = z.object({
  action: z.literal("choose"),
  cardId: z.string().min(1).nullable(),
  style: z.enum(["still", "living"]).default("living"),
});
const Compose = z.object({ action: z.literal("compose") });
const Quiet = z.object({ action: z.literal("quiet"), hours: z.number().int().min(2).max(12) });
const Wall = z.object({ action: z.literal("wall"), wall: z.enum(WALLS) });
const People = z.object({ action: z.literal("people"), people: z.array(z.string().min(1).max(64)).max(2) });

export async function POST(req: Request): Promise<Response> {
  const auth = await requireSession(req);
  if (auth instanceof Response) return auth;
  if (!checkRateLimit(auth, "/api/window")) return Response.json({ error: "rate-limited" }, { status: 429 });
  const body = await req.json().catch(() => null);
  const now = new Date().toISOString();
  const mine = await getDoc(auth.familyId, "window_view", auth.memberId);

  const choose = Choose.safeParse(body);
  if (choose.success) {
    const imageRef = choose.data.cardId ? await photoRefFor(auth.familyId, choose.data.cardId) : null;
    if (choose.data.cardId && !imageRef) return Response.json({ error: "unknown-photo" }, { status: 404 });
    const view = await putDoc(auth.familyId, "window_view", {
      ...(mine ?? {}),
      id: auth.memberId,
      memberId: auth.memberId,
      cardId: choose.data.cardId,
      imageRef,
      style: choose.data.style,
      madeBy: "family",
      updatedAt: now,
    });
    return Response.json({ view });
  }

  const base = mine ?? { id: auth.memberId, memberId: auth.memberId, cardId: null, imageRef: null, style: "living" as const };
  const wall = Wall.safeParse(body);
  if (wall.success) return Response.json({ view: await putDoc(auth.familyId, "window_view", { ...base, wall: wall.data.wall, updatedAt: mine?.updatedAt ?? now }) });
  const people = People.safeParse(body);
  if (people.success) {
    const members = await dbListMembers(auth.familyId);
    const ids = Array.from(new Set(people.data.people)).filter((id) => id !== auth.memberId && members.some((m) => m.id === id));
    return Response.json({ view: await putDoc(auth.familyId, "window_view", { ...base, people: ids, updatedAt: mine?.updatedAt ?? now }) });
  }

  const quiet = Quiet.safeParse(body);
  if (quiet.success) {
    const view = await putDoc(auth.familyId, "window_view", {
      ...(mine ?? { id: auth.memberId, memberId: auth.memberId, cardId: null, imageRef: null, style: "living" }),
      quietAfterHours: quiet.data.hours,
      updatedAt: mine?.updatedAt ?? now,
    });
    return Response.json({ view });
  }

  if (Compose.safeParse(body).success) {
    const state = await windowState(auth.familyId, auth.memberId);
    if (state.view?.style === "still") return Response.json({ error: "still-window" }, { status: 409 });
    const caption = state.view?.cardId ? (withDemoShelf(await dbListCards(auth.familyId), auth.familyId).find((c) => c.id === state.view?.cardId)?.caption ?? "") : "";
    const scene = await composeWindow(auth.familyId, { ...state, layers: state.layers }, caption);
    const view = await putDoc(auth.familyId, "window_view", {
      ...(mine ?? { id: auth.memberId, memberId: auth.memberId, cardId: null, imageRef: null, style: "living" }),
      layers: scene.layers,
      line: scene.line,
      madeBy: scene.source === "muse" ? "muse" : "family",
      updatedAt: now,
    });
    return Response.json({ view, source: scene.source });
  }
  return Response.json({ error: "invalid-window" }, { status: 400 });
}
