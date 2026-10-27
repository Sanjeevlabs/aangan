import { CreateReactionRequestSchema } from "@/lib/schemas";
import { getMember, listCards, listReactions, setReaction } from "@/lib/store";

export async function GET(req: Request): Promise<Response> {
  const { searchParams } = new URL(req.url);
  return Response.json({ reactions: listReactions(searchParams.get("cardId") ?? undefined) });
}

export async function POST(req: Request): Promise<Response> {
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
  if (!listCards().some((c) => c.id === parsed.data.cardId)) {
    return Response.json({ error: "unknown-card" }, { status: 404 });
  }
  if (!getMember(parsed.data.memberId)) {
    return Response.json({ error: "unknown-member" }, { status: 404 });
  }
  // One per member per card: setReaction replaces the member's prior kind.
  const reaction = setReaction({
    id: crypto.randomUUID(),
    familyId: "demo-family",
    createdAt: new Date().toISOString(),
    ...parsed.data,
  });
  return Response.json({ reaction }, { status: 201 });
}
