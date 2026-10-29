import { dbListRitualRuns } from "@/lib/db";
import { requireSession } from "@/lib/auth";

export async function GET(req: Request): Promise<Response> {
  const auth = await requireSession(req);
  if (auth instanceof Response) return auth;
  return Response.json({ runs: await dbListRitualRuns(auth.familyId) });
}
