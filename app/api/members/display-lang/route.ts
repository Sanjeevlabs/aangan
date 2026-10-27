import { DisplayLangRequestSchema } from "@/lib/schemas";
import { setMemberDisplayLang } from "@/lib/store";

export async function POST(req: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "invalid-json" }, { status: 400 });
  }
  const parsed = DisplayLangRequestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "invalid-display-lang" }, { status: 400 });
  }
  const member = setMemberDisplayLang(parsed.data.memberId, parsed.data.displayLang);
  if (!member) return Response.json({ error: "unknown-member" }, { status: 404 });
  return Response.json({ member });
}
