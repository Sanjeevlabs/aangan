import { z } from "zod";
import { checkRateLimit, requireSession } from "@/lib/auth";
import { dbListCards } from "@/lib/db";
import { getDoc, listDocs, putDoc } from "@/lib/family-docs";
import { isComplete, sideOf, streak, viewFor } from "@/lib/today";
import { ensureToday } from "@/lib/today-server";
import { dbListMembers } from "@/lib/db";
import { nextOccasionFor } from "@/lib/occasions-server";
import { withDemoShelf } from "@/lib/demo";
import { guardWrites } from "@/lib/api-guard";

// Today: one task, both homes. Your answer is a voice note you recorded; the
// other side's answer is sealed until you add yours.

async function getHandler(req: Request): Promise<Response> {
  const auth = await requireSession(req);
  if (auth instanceof Response) return auth;
  if (!checkRateLimit(auth, "/api/today")) return Response.json({ error: "rate-limited" }, { status: 429 });
  const task = await ensureToday(auth.familyId);
  const occasion = await nextOccasionFor(auth.familyId, await dbListMembers(auth.familyId));
  if (!task) return Response.json({ task: null, streak: 0, recent: [], occasion });
  const all = await listDocs(auth.familyId, "today_task");
  const recent = all.filter((t) => t.id !== task.id && t.completedAt).slice(0, 6).map((t) => viewFor(t, auth.memberId));
  return Response.json({ task: viewFor(task, auth.memberId), streak: streak(all, task.date), recent, occasion });
}

const Answer = z.object({ action: z.literal("answer"), taskId: z.string().min(1), cardId: z.string().min(1) });

async function postHandler(req: Request): Promise<Response> {
  const auth = await requireSession(req);
  if (auth instanceof Response) return auth;
  if (!checkRateLimit(auth, "/api/today")) return Response.json({ error: "rate-limited" }, { status: 429 });
  const parsed = Answer.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "invalid-today" }, { status: 400 });
  const task = await getDoc(auth.familyId, "today_task", parsed.data.taskId);
  if (!task) return Response.json({ error: "unknown-task" }, { status: 404 });
  if (!sideOf(task, auth.memberId)) return Response.json({ error: "not-your-task" }, { status: 403 });
  // The answer must be your own voice note in this family.
  const card = withDemoShelf(await dbListCards(auth.familyId), auth.familyId).find((c) => c.id === parsed.data.cardId);
  if (!card || card.authorId !== auth.memberId || card.type !== "audio") return Response.json({ error: "not-your-card" }, { status: 403 });
  if (task.answers.some((a) => a.cardId === card.id)) return Response.json({ task: viewFor(task, auth.memberId) });
  const now = new Date().toISOString();
  const next = { ...task, answers: [...task.answers.filter((a) => a.memberId !== auth.memberId), { memberId: auth.memberId, cardId: card.id, at: now }] };
  if (!next.completedAt && isComplete(next)) next.completedAt = now;
  const saved = await putDoc(auth.familyId, "today_task", next);
  return Response.json({ task: viewFor(saved, auth.memberId), completed: Boolean(saved.completedAt) });
}

export const GET = guardWrites(getHandler);
export const POST = guardWrites(postHandler);
