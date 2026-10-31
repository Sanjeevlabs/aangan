import { checkRateLimit, requireSession } from "@/lib/auth";
import { dbGetMember } from "@/lib/db";
import { isGrownUp } from "@/lib/permissions";
import { guardWrites } from "@/lib/api-guard";
import { letterLang } from "@/lib/weekly-letter";
import { draftWeeklyLetter } from "@/lib/weekly-letter-run";

// Draft this week's letter now (the demo can show it on demand). Nothing is
// sent: the letter waits as a suggestion until a grown-up approves it.
async function postHandler(req: Request): Promise<Response> {
  const auth = await requireSession(req);
  if (auth instanceof Response) return auth;
  if (!checkRateLimit(auth, "/api/letters/weekly")) return Response.json({ error: "rate-limited" }, { status: 429 });
  const me = await dbGetMember(auth.memberId);
  if (!me || me.familyId !== auth.familyId || !isGrownUp(me) || me.role === "child") return Response.json({ error: "grown-ups-only" }, { status: 403 });
  const out = await draftWeeklyLetter(auth.familyId, { lang: letterLang(me.displayLang), by: "manual" });
  if (out.status === "created") return Response.json({ suggestion: out.suggestion }, { status: 201 });
  if (out.status === "exists") return Response.json({ suggestion: out.suggestion, existing: true });
  return Response.json({ suggestion: null, reason: "quiet-week" });
}

export const POST = guardWrites(postHandler);
