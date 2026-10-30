import { requireSession } from "@/lib/auth";
import { dbListCards, dbListPlays } from "@/lib/db";
import { DEMO_SHELF_CARDS } from "@/lib/demo";
import { listDocs } from "@/lib/family-docs";
import { giftsFor } from "@/lib/gifts";

// GET → what the signed-in person's gifts did this week (their recipes cooked,
// their stories and answers heard). Read-only, the session's family only.
export async function GET(req: Request): Promise<Response> {
  const auth = await requireSession(req);
  if (auth instanceof Response) return auth;
  const live = await dbListCards(auth.familyId);
  const cards = [...live, ...DEMO_SHELF_CARDS.filter((d) => d.familyId === auth.familyId && !live.some((c) => c.id === d.id))];
  const [plays, recipes, attempts, stories, questions] = await Promise.all([
    dbListPlays(undefined, auth.familyId),
    listDocs(auth.familyId, "recipe"),
    listDocs(auth.familyId, "attempt"),
    listDocs(auth.familyId, "story"),
    listDocs(auth.familyId, "question"),
  ]);
  return Response.json({ gifts: giftsFor(auth.memberId, { cards, plays, recipes, attempts, stories, questions }) });
}
