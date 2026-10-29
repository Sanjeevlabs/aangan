import { z } from "zod";
import { CreateReactionRequestSchema } from "@/lib/schemas";
import { dbGetMember, dbListCards, dbListReactions, dbRemoveReaction, dbSetReaction } from "@/lib/db";
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
  const cards = await dbListCards(auth.familyId);
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

// Take your reaction back (tap it again).
export async function DELETE(req: Request): Promise<Response> {
  const auth = requireSession(req);
  if (auth instanceof Response) return auth;
  const parsed = z.object({ cardId: z.string().min(1) }).safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "invalid-reaction" }, { status: 400 });
  await dbRemoveReaction(parsed.data.cardId, auth.memberId);
  return Response.json({ removed: true });
}
