import { z } from "zod";
import { requireSession } from "@/lib/auth";
import { dbListCards, dbListMembers } from "@/lib/db";
import { getDoc, listDocs, newId, putDoc } from "@/lib/family-docs";
import { recipeFromVoice } from "@/lib/kitchen";

// The family Kitchen.
// GET  → every recipe and every attempt (who cooked what, and who blessed it).
// POST → teach (voice card → recipe via Muse), attempt ("I made this"),
//        bless (the cook, or anyone, blesses an attempt), ask (request a recipe
//        from an elder: becomes their weekly-question style prompt).

const Body = z.discriminatedUnion("action", [
  z.object({ action: z.literal("teach"), cardId: z.string().min(1), title: z.string().trim().max(80).optional(), questionId: z.string().optional() }),
  z.object({ action: z.literal("attempt"), recipeId: z.string().min(1), photoRef: z.string().max(512).nullable().optional(), note: z.string().trim().max(240).default("") }),
  z.object({ action: z.literal("bless"), attemptId: z.string().min(1) }),
  z.object({ action: z.literal("ask"), toMemberId: z.string().min(1), dish: z.string().trim().min(2).max(60) }),
  z.object({ action: z.literal("rename"), recipeId: z.string().min(1), title: z.string().trim().min(1).max(80), memory: z.string().trim().max(240).optional() }),
]);

export async function GET(req: Request): Promise<Response> {
  const auth = requireSession(req);
  if (auth instanceof Response) return auth;
  const [recipes, attempts] = await Promise.all([listDocs(auth.familyId, "recipe"), listDocs(auth.familyId, "attempt")]);
  return Response.json({ recipes, attempts });
}

export async function POST(req: Request): Promise<Response> {
  const auth = requireSession(req);
  if (auth instanceof Response) return auth;
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return Response.json({ error: "invalid-json" }, { status: 400 });
  }
  const parsed = Body.safeParse(raw);
  if (!parsed.success) return Response.json({ error: "invalid-kitchen" }, { status: 400 });
  const body = parsed.data;
  const now = new Date().toISOString();

  if (body.action === "teach") {
    const card = (await dbListCards(auth.familyId)).find((c) => c.id === body.cardId);
    if (!card || card.type !== "audio") return Response.json({ error: "unknown-voice-note" }, { status: 404 });
    const cookId = card.authorId ?? auth.memberId;
    const cook = (await dbListMembers(auth.familyId)).find((m) => m.id === cookId);
    const transcript = card.transcript || card.caption;
    if (!transcript.trim()) return Response.json({ error: "nothing-said" }, { status: 422 });
    const { draft, source } = await recipeFromVoice({ familyId: auth.familyId, transcript, lang: card.transcriptLang || card.lang, cookName: cook?.displayName ?? "the cook", title: body.title });
    const recipe = await putDoc(auth.familyId, "recipe", {
      id: newId("recipe"),
      ...draft,
      cookId,
      voiceCardId: card.id,
      coverRef: null,
      lang: card.transcriptLang || card.lang,
      madeBy: source === "muse" ? "muse" : "family",
      createdAt: now,
    });
    if (body.questionId) {
      const q = await getDoc(auth.familyId, "question", body.questionId);
      if (q) await putDoc(auth.familyId, "question", { ...q, answeredCardId: card.id });
    }
    return Response.json({ recipe }, { status: 201 });
  }

  if (body.action === "attempt") {
    const recipe = await getDoc(auth.familyId, "recipe", body.recipeId);
    if (!recipe) return Response.json({ error: "unknown-recipe" }, { status: 404 });
    const attempt = await putDoc(auth.familyId, "attempt", { id: newId("cooked"), recipeId: recipe.id, memberId: auth.memberId, photoRef: body.photoRef ?? null, note: body.note, blessedBy: [], createdAt: now });
    return Response.json({ attempt }, { status: 201 });
  }

  if (body.action === "bless") {
    const attempt = await getDoc(auth.familyId, "attempt", body.attemptId);
    if (!attempt) return Response.json({ error: "unknown-attempt" }, { status: 404 });
    if (attempt.memberId === auth.memberId) return Response.json({ error: "own-attempt" }, { status: 409 });
    const blessedBy = attempt.blessedBy.includes(auth.memberId) ? attempt.blessedBy : [...attempt.blessedBy, auth.memberId];
    return Response.json({ attempt: await putDoc(auth.familyId, "attempt", { ...attempt, blessedBy }) });
  }

  if (body.action === "rename") {
    const recipe = await getDoc(auth.familyId, "recipe", body.recipeId);
    if (!recipe) return Response.json({ error: "unknown-recipe" }, { status: 404 });
    return Response.json({ recipe: await putDoc(auth.familyId, "recipe", { ...recipe, title: body.title, memory: body.memory ?? recipe.memory }) });
  }

  // ask: a grandchild asks an elder for a recipe; it waits on the elder's home.
  const to = (await dbListMembers(auth.familyId)).find((m) => m.id === body.toMemberId);
  if (!to) return Response.json({ error: "unknown-member" }, { status: 404 });
  const question = await putDoc(auth.familyId, "question", {
    id: newId("ask"),
    toMemberId: to.id,
    text: `How do you make your ${body.dish}?`,
    askedBy: auth.memberId,
    topic: "recipe",
    answeredCardId: null,
    madeBy: "family",
    createdAt: now,
  });
  return Response.json({ question }, { status: 201 });
}
