import { CreateReactionRequestSchema } from "@/lib/schemas";
import { dbGetMember, dbListCards, dbListReactions, dbSetReaction } from "@/lib/db";
import { requireMember, requireSession } from "@/lib/auth";

export async function GET(req: Request): Promise<Response> {
  const auth = requireSession(req);
  if (auth instanceof Response) return auth;
  const { searchParams } = new URL(req.url);
  return Response.json({ reactions: await dbListReactions(searchParams.get("cardId") ?? undefined) });
}

export async function POST(req: Request): Promise<Response> {
  const auth = requireSession(req);
  if (auth instanceof Response) return auth;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "invalid-json" }, { status: 400 });
  }
  const parsed = CreateReactionRequestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "invalid-reaction" }, { status: 400 });
  }
  const ownership = requireMember(auth, parsed.data.memberId);
  if (ownership) return ownership;
  const cards = await dbListCards();
  if (!cards.some((c) => c.id === parsed.data.cardId)) {
    return Response.json({ error: "unknown-card" }, { status: 404 });
  }
  if (!(await dbGetMember(parsed.data.memberId))) {
    return Response.json({ error: "unknown-member" }, { status: 404 });
  }
  // One per member per card: setReaction replaces the member's prior kind.
  const reaction = await dbSetReaction(parsed.data);
  return Response.json({ reaction }, { status: 201 });
}
