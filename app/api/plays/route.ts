import { CreatePlayRequestSchema } from "@/lib/schemas";
import { dbAddPlay, dbGetMember, dbListCards, dbListPlays } from "@/lib/db";

export async function GET(req: Request): Promise<Response> {
  const { searchParams } = new URL(req.url);
  return Response.json({ plays: await dbListPlays(searchParams.get("cardId") ?? undefined) });
}

export async function POST(req: Request): Promise<Response> {
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
  const cards = await dbListCards();
  if (!cards.some((c) => c.id === parsed.data.cardId)) {
    return Response.json({ error: "unknown-card" }, { status: 404 });
  }
  if (!(await dbGetMember(parsed.data.memberId))) {
    return Response.json({ error: "unknown-member" }, { status: 404 });
  }
  const play = await dbAddPlay(parsed.data);
  return Response.json({ play }, { status: 201 });
}
