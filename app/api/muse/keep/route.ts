import { z } from "zod";
import { requireSession } from "@/lib/auth";
import { CARD_NOTE_MAX, CARD_PLACE_MAX } from "@/lib/card-limits";
import { dbAddCard } from "@/lib/db";
import { getDoc, putDoc } from "@/lib/family-docs";

// "Keep": the only way a Muse render becomes a family card. Tied to a real
// render by this person (a muse_image_run), kept once, and always labelled
// by its source (Painted by Muse / Restored by Muse) in every viewer.

const Body = z.object({
  runId: z.string().min(1).max(80),
  mediaRef: z.string().min(1).max(512),
  /** A restored photo keeps its original alongside (stored as the card's cover ref). */
  originalRef: z.string().min(1).max(512).optional(),
  palette: z.array(z.string().max(9)).max(5).default([]),
  caption: z.string().trim().max(280).default(""),
  /** A restored photo keeps the original's date; a portrait is dated today. */
  takenAt: z.string().datetime().optional(),
  place: z.string().trim().max(CARD_PLACE_MAX).default(""),
  note: z.string().trim().max(CARD_NOTE_MAX).default(""),
});

export async function POST(req: Request): Promise<Response> {
  const auth = await requireSession(req);
  if (auth instanceof Response) return auth;
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return Response.json({ error: "invalid-json" }, { status: 400 });
  }
  const parsed = Body.safeParse(raw);
  if (!parsed.success) return Response.json({ error: "invalid-keep" }, { status: 400 });
  const body = parsed.data;
  // Our own storage or this tab's preview only; never another host.
  if ([body.mediaRef, body.originalRef ?? ""].some((r) => /^(https?:)?\/\//i.test(r))) return Response.json({ error: "invalid-media" }, { status: 400 });

  const run = await getDoc(auth.familyId, "muse_image_run", body.runId);
  if (!run || run.by !== auth.memberId) return Response.json({ error: "unknown-render" }, { status: 404 });
  if (run.keptCardId) return Response.json({ error: "already-kept" }, { status: 409 });

  const portrait = run.kind === "portrait";
  const now = new Date();
  const takenAt = !portrait && body.takenAt && Date.parse(body.takenAt) <= now.getTime() ? body.takenAt : now.toISOString();
  const card = await dbAddCard({
    id: crypto.randomUUID(),
    familyId: auth.familyId,
    authorId: auth.memberId,
    type: "photo",
    caption: body.caption || (portrait ? "A family portrait, painted by Muse from our photos" : "An old photo, restored by Muse"),
    summary: "",
    lang: "en",
    takenAt,
    ritualSlug: null,
    source: portrait ? "muse-portrait" : "muse-restored",
    mediaRef: body.mediaRef,
    coverRef: !portrait ? (body.originalRef ?? null) : null,
    palette: body.palette,
    place: body.place,
    note: body.note,
  });
  await putDoc(auth.familyId, "muse_image_run", { ...run, keptCardId: card.id });
  return Response.json({ card }, { status: 201 });
}
