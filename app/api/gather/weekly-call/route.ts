import { z } from "zod";
import { guardWrites } from "@/lib/api-guard";
import { checkRateLimit, requireSession } from "@/lib/auth";
import { dbGetMember, dbListMembers } from "@/lib/db";
import { getDoc, putDoc } from "@/lib/family-docs";
import { can } from "@/lib/permissions";
import { validTz } from "@/lib/weekly-call";

// The family's one fixed weekly call. Anyone can read it; any grown-up with
// planning rights can set it. One document, id "weekly-call".
const Body = z.object({
  weekday: z.number().int().min(0).max(6),
  hour: z.number().int().min(0).max(23),
  minute: z.number().int().min(0).max(59),
  tz: z.string().min(1).max(64).refine(validTz, "unknown-zone"),
  hostId: z.string().min(1).max(64),
  name: z.string().trim().max(40).optional(),
});

async function getHandler(req: Request): Promise<Response> {
  const auth = await requireSession(req);
  if (auth instanceof Response) return auth;
  const [call, me] = await Promise.all([getDoc(auth.familyId, "weekly_call", "weekly-call"), dbGetMember(auth.memberId)]);
  return Response.json({ call: call ?? null, canSet: Boolean(me && can(me, "events.plan") && me.role !== "child") });
}

async function putHandler(req: Request): Promise<Response> {
  const auth = await requireSession(req);
  if (auth instanceof Response) return auth;
  const me = await dbGetMember(auth.memberId);
  if (!me || !can(me, "events.plan") || me.role === "child") return Response.json({ error: "grown-ups-only" }, { status: 403 });
  if (!checkRateLimit(auth, "/api/gather")) return Response.json({ error: "rate-limited" }, { status: 429 });
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "invalid-weekly-call" }, { status: 400 });
  const body = parsed.data;
  const members = await dbListMembers(auth.familyId);
  if (!members.some((m) => m.id === body.hostId)) return Response.json({ error: "unknown-member" }, { status: 400 });
  const call = await putDoc(auth.familyId, "weekly_call", {
    id: "weekly-call",
    weekday: body.weekday,
    hour: body.hour,
    minute: body.minute,
    tz: body.tz,
    hostId: body.hostId,
    ...(body.name ? { name: body.name } : {}),
    updatedBy: auth.memberId,
    updatedAt: new Date().toISOString(),
  });
  return Response.json({ call });
}

export const GET = guardWrites(getHandler);
export const PUT = guardWrites(putHandler);
