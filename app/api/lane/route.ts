import { requireSession } from "@/lib/auth";
import { dbListCards, dbListMembers, dbListRitualRuns, dbListWishes } from "@/lib/db";
import { withDemoShelf } from "@/lib/demo";
import { listDocs } from "@/lib/family-docs";
import { laneElsewhere } from "@/lib/lane-groups";
import { claimedByOccasions } from "@/lib/occasion-album";

// GET /api/lane → { elsewhere }: ids of the cards another tab shows
// (Occasions, Stories, The Book, Advice). Memory Lane leaves them out, so it
// is the family's everyday photos and voices and nothing shows twice.
export async function GET(req: Request): Promise<Response> {
  const auth = await requireSession(req);
  if (auth instanceof Response) return auth;
  const f = auth.familyId;
  const [stored, albums, runs, wishes, stories, questions, tasks, members] = await Promise.all([
    dbListCards(f),
    listDocs(f, "album"),
    dbListRitualRuns(f),
    dbListWishes(undefined, f),
    listDocs(f, "story"),
    listDocs(f, "question"),
    listDocs(f, "today_task"),
    dbListMembers(f),
  ]);
  const cards = withDemoShelf(stored, f);
  const wishCards = wishes.filter((w) => w.ritualRunId && w.cardId).map((w) => ({ ritualRunId: w.ritualRunId, cardId: w.cardId }));
  const elsewhere = laneElsewhere({
    occasions: claimedByOccasions(cards, albums, runs, wishCards),
    stories,
    questions,
    tasks,
    bookIds: members.filter((m) => m.role === "elder").map((m) => m.id),
    cards,
  });
  return Response.json({ elsewhere: [...elsewhere] });
}
