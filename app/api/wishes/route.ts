import { CreateWishRequestSchema } from "@/lib/schemas";
import { dbAddWish, dbGetMember, dbListWishes } from "@/lib/db";

export async function GET(req: Request): Promise<Response> {
  const { searchParams } = new URL(req.url);
  return Response.json({ wishes: await dbListWishes(searchParams.get("runId") ?? undefined) });
}

// Record a wish/blessing, optionally linked to a voice card.
export async function POST(req: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "invalid-json" }, { status: 400 });
  }
  const parsed = CreateWishRequestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "invalid-wish" }, { status: 400 });
  }
  if (!(await dbGetMember(parsed.data.memberId))) {
    return Response.json({ error: "unknown-member" }, { status: 404 });
  }
  const wish = await dbAddWish(parsed.data);
  return Response.json({ wish }, { status: 201 });
}
