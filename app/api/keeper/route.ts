import { z } from "zod";
import { requireSession } from "@/lib/auth";
import { dbAddAgentRun, dbGetMember, dbListCards, dbListMembers } from "@/lib/db";
import { deleteDoc, getDoc, listDocs, newId, putDoc } from "@/lib/family-docs";
import { can } from "@/lib/permissions";
import { askWeeklyQuestions } from "@/lib/keeper";

// Questions for elders: the weekly one Muse asks, and the ones family ask.
const Body = z.discriminatedUnion("action", [
  z.object({ action: z.literal("weekly") }),
  z.object({ action: z.literal("answer"), questionId: z.string().min(1), cardId: z.string().min(1) }),
  z.object({ action: z.literal("ask"), toMemberId: z.string().min(1), text: z.string().trim().min(6).max(200) }),
  // The person who asked withdraws it; the elder may skip any question.
  z.object({ action: z.literal("remove"), questionId: z.string().min(1) }),
]);

export async function GET(req: Request): Promise<Response> {
  const auth = requireSession(req);
  if (auth instanceof Response) return auth;
  return Response.json({ questions: await listDocs(auth.familyId, "question") });
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
  if (!parsed.success) return Response.json({ error: "invalid-keeper" }, { status: 400 });
  const body = parsed.data;

  if (body.action === "weekly") {
    const created = await askWeeklyQuestions(auth.familyId, await dbListMembers(auth.familyId));
    if (created.length) await dbAddAgentRun({ goal: `Story keeper: asked ${created.length} weekly question${created.length > 1 ? "s" : ""}`, tools: ["muse-spark", "ask_elder_question"], familyId: auth.familyId });
    return Response.json({ created });
  }

  if (body.action === "remove") {
    const q = await getDoc(auth.familyId, "question", body.questionId);
    if (!q) return Response.json({ error: "unknown-question" }, { status: 404 });
    const me = await dbGetMember(auth.memberId);
    const mayRemove = q.toMemberId === auth.memberId || q.askedBy === auth.memberId || can(me, "content.moderate");
    if (!mayRemove) return Response.json({ error: "not-yours" }, { status: 403 });
    await deleteDoc(auth.familyId, "question", q.id);
    return Response.json({ removed: q.id });
  }

  if (body.action === "answer") {
    const q = await getDoc(auth.familyId, "question", body.questionId);
    if (!q) return Response.json({ error: "unknown-question" }, { status: 404 });
    if (q.toMemberId !== auth.memberId) return Response.json({ error: "not-yours" }, { status: 403 });
    const card = (await dbListCards(auth.familyId)).find((c) => c.id === body.cardId);
    if (!card) return Response.json({ error: "unknown-card" }, { status: 404 });
    return Response.json({ question: await putDoc(auth.familyId, "question", { ...q, answeredCardId: card.id }) });
  }

  const to = (await dbListMembers(auth.familyId)).find((m) => m.id === body.toMemberId);
  if (!to) return Response.json({ error: "unknown-member" }, { status: 404 });
  const question = await putDoc(auth.familyId, "question", {
    id: newId("ask"),
    toMemberId: to.id,
    text: body.text,
    lang: "en",
    askedBy: auth.memberId,
    topic: "story",
    answeredCardId: null,
    madeBy: "family",
    createdAt: new Date().toISOString(),
  });
  return Response.json({ question }, { status: 201 });
}
