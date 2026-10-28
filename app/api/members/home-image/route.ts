import { HomeImageRequestSchema } from "@/lib/schemas";
import { dbSetMemberHome } from "@/lib/db";

export async function POST(req: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "invalid-json" }, { status: 400 });
  }
  const parsed = HomeImageRequestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "invalid-home-image" }, { status: 400 });
  }
  const member = await dbSetMemberHome(parsed.data.memberId, parsed.data.mediaRef, parsed.data.palette);
  if (!member) {
    return Response.json({ error: "unknown-member" }, { status: 404 });
  }
  return Response.json({ member });
}
