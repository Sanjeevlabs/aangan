import { DEMO_FAMILY } from "@/lib/family";
import { dbGetFamilyName, dbListMembers } from "@/lib/db";
import { requireSession } from "@/lib/auth";

export async function GET(req: Request): Promise<Response> {
  const auth = requireSession(req);
  if (auth instanceof Response) return auth;
  const [members, name] = await Promise.all([dbListMembers(auth.familyId), dbGetFamilyName(auth.familyId)]);
  return Response.json({ members, family: { ...DEMO_FAMILY, id: auth.familyId, name: name.replace(/^the\s+/i, "").replace(/\s+family$/i, "") || DEMO_FAMILY.name } });
}
