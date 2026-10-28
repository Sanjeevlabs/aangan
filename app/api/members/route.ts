import { DEMO_FAMILY } from "@/lib/family";
import { dbListMembers } from "@/lib/db";
import { requireSession } from "@/lib/auth";

export async function GET(req: Request): Promise<Response> {
  const auth = requireSession(req);
  if (auth instanceof Response) return auth;
  return Response.json({ members: await dbListMembers(auth.familyId), family: DEMO_FAMILY });
}
