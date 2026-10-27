import { CreateCardRequestSchema } from "@/lib/schemas";
import { addCard, listCards } from "@/lib/store";

export async function GET(): Promise<Response> {
  return Response.json({ cards: listCards() });
}

export async function POST(req: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "invalid-json" }, { status: 400 });
  }
  const parsed = CreateCardRequestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "invalid-card" }, { status: 400 });
  }
  const card = addCard({
    id: crypto.randomUUID(),
    familyId: "demo-family",
    summary: "",
    ritualSlug: null,
    ...parsed.data,
  });
  return Response.json({ card }, { status: 201 });
}
