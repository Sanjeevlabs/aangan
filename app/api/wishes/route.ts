import { CreateWishRequestSchema } from "@/lib/schemas";
import { dbAddWish, dbGetMember, dbListWishes } from "@/lib/db";
import { requireMember, requireSession } from "@/lib/auth";

export async function GET(req: Request): Promise<Response> {
  const auth = requireSession(req);
  if (auth instanceof Response) return auth;
  const { searchParams } = new URL(req.url);
  return Response.json({ wishes: await dbListWishes(searchParams.get("runId") ?? undefined) });
}

// Record a wish/blessing, optionally linked to a voice card. The wish must
// be the session member's own (replies post as the viewer).
export async function POST(req: Request): Promise<Response> {
  const auth = requireSession(req);
  if (auth instanceof Response) return auth;
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
  const ownership = requireMember(auth, parsed.data.memberId);
  if (ownership) return ownership;
  if (!(await dbGetMember(parsed.data.memberId))) {
    return Response.json({ error: "unknown-member" }, { status: 404 });
  }
  const wish = await dbAddWish(parsed.data);
  return Response.json({ wish }, { status: 201 });
}
