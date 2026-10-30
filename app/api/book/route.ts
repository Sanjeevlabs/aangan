import { requireSession } from "@/lib/auth";
import { dbListCards, dbListMembers } from "@/lib/db";
import { withDemoShelf } from "@/lib/demo";
import { listDocs } from "@/lib/family-docs";
import { bookChapters } from "./chapters";

// GET /api/book?member=<id> → that person's chapters, newest first.
export async function GET(req: Request): Promise<Response> {
  const auth = await requireSession(req);
  if (auth instanceof Response) return auth;
  const memberId = new URL(req.url).searchParams.get("member") ?? "";
  const members = await dbListMembers(auth.familyId);
  if (!members.some((m) => m.id === memberId)) return Response.json({ error: "unknown-member" }, { status: 404 });
  const [tasks, questions, stored] = await Promise.all([listDocs(auth.familyId, "today_task"), listDocs(auth.familyId, "question"), dbListCards(auth.familyId)]);
  const chapters = bookChapters({ memberId, viewerId: auth.memberId, tasks, questions, cards: withDemoShelf(stored, auth.familyId), members });
  return Response.json({ member: memberId, chapters });
}
