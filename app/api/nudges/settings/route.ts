import { z } from "zod";
import { requireSession } from "@/lib/auth";
import { dbGetMember } from "@/lib/db";
import { putDoc } from "@/lib/family-docs";
import { nudgeSettingsFor } from "@/lib/nudges";
import { guardWrites } from "@/lib/api-guard";

const Body = z.object({ email: z.boolean(), maxPerWeek: z.number().int().min(0).max(3) });

async function getHandler(req: Request): Promise<Response> {
  const auth = await requireSession(req);
  if (auth instanceof Response) return auth;
  const me = await dbGetMember(auth.memberId);
  return Response.json({ settings: await nudgeSettingsFor(auth.familyId, auth.memberId, me ?? undefined), hasEmail: Boolean(me?.email) });
}

// Your own settings only; the member id is the session's.
async function putHandler(req: Request): Promise<Response> {
  const auth = await requireSession(req);
  if (auth instanceof Response) return auth;
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "invalid-nudge-settings" }, { status: 400 });
  return Response.json({ settings: await putDoc(auth.familyId, "nudge_settings", { id: auth.memberId, ...parsed.data }) });
}

export const GET = guardWrites(getHandler);
export const PUT = guardWrites(putHandler);
