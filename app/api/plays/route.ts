import { CreatePlayRequestSchema } from "@/lib/schemas";
import { dbAddPlay, dbGetMember, dbListCards, dbListPlays } from "@/lib/db";
import { requireMember, requireSession } from "@/lib/auth";

export async function GET(req: Request): Promise<Response> {
  const auth = await requireSession(req);
  if (auth instanceof Response) return auth;
  const { searchParams } = new URL(req.url);
  return Response.json({ plays: await dbListPlays(searchParams.get("cardId") ?? undefined, auth.familyId) });
}

export async function POST(req: Request): Promise<Response> {
  const auth = await requireSession(req);
  if (auth instanceof Response) return auth;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "invalid-json" }, { status: 400 });
  }
  const parsed = CreatePlayRequestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "invalid-play" }, { status: 400 });
  }
  const ownership = requireMember(auth, parsed.data.memberId);
  if (ownership) return ownership;
  const cards = await dbListCards(auth.familyId);
  if (!cards.some((c) => c.id === parsed.data.cardId)) {
    return Response.json({ error: "unknown-card" }, { status: 404 });
  }
  if (!(await dbGetMember(parsed.data.memberId))) {
    return Response.json({ error: "unknown-member" }, { status: 404 });
  }
  const play = await dbAddPlay({ ...parsed.data, familyId: auth.familyId });
  return Response.json({ play }, { status: 201 });
}
