import { z } from "zod";
import { requireSession } from "@/lib/auth";
import { markSeen } from "@/lib/nudges";
import { guardWrites } from "@/lib/api-guard";

const Body = z.object({ ids: z.union([z.literal("all"), z.array(z.string().min(1).max(80)).max(50)]).default("all") });

// Mark your own nudges as seen. Only the session member's are touched.
async function postHandler(req: Request): Promise<Response> {
  const auth = await requireSession(req);
  if (auth instanceof Response) return auth;
  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return Response.json({ error: "invalid-nudges" }, { status: 400 });
  return Response.json({ seen: await markSeen(auth.familyId, auth.memberId, parsed.data.ids) });
}

export const POST = guardWrites(postHandler);
