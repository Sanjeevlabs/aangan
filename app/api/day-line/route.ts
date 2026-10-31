import { z } from "zod";
import { requireSession } from "@/lib/auth";
import { dbGetMember } from "@/lib/db";
import { DAY_LINE_MAX, allowDayLineWrite, endOfLocalDay, liveLines } from "@/lib/day-line";
import { deleteDoc, listDocs, putDoc } from "@/lib/family-docs";

// A line about today. GET: the family's lines still showing (their author's
// local day hasn't ended). POST: write or replace YOUR line. DELETE: take
// yours down. The author is always the session member, never the body.

const Body = z.object({ text: z.string().trim().min(1).max(DAY_LINE_MAX) });

export async function GET(req: Request): Promise<Response> {
  const auth = await requireSession(req);
  if (auth instanceof Response) return auth;
  const lines = liveLines(await listDocs(auth.familyId, "day_line"));
  return Response.json({ lines: lines.map((l) => ({ memberId: l.memberId, text: l.text, until: l.until })) });
}

export async function POST(req: Request): Promise<Response> {
  const auth = await requireSession(req);
  if (auth instanceof Response) return auth;
  if (!allowDayLineWrite(`${auth.familyId}:${auth.memberId}`)) return Response.json({ error: "rate-limited" }, { status: 429 });
  const raw = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  // Someone else's line can't be written, whatever the body claims.
  if (raw && typeof raw.memberId === "string" && raw.memberId !== auth.memberId) return Response.json({ error: "forbidden-member" }, { status: 403 });
  const parsed = Body.safeParse(raw);
  if (!parsed.success) return Response.json({ error: "invalid-line" }, { status: 400 });
  const member = await dbGetMember(auth.memberId);
  const now = new Date();
  const line = await putDoc(auth.familyId, "day_line", {
    id: auth.memberId,
    memberId: auth.memberId,
    text: parsed.data.text,
    until: endOfLocalDay(member?.tz ?? "UTC", now),
    createdAt: now.toISOString(),
  });
  return Response.json({ line: { memberId: line.memberId, text: line.text, until: line.until } }, { status: 201 });
}

export async function DELETE(req: Request): Promise<Response> {
  const auth = await requireSession(req);
  if (auth instanceof Response) return auth;
  if (!allowDayLineWrite(`${auth.familyId}:${auth.memberId}`)) return Response.json({ error: "rate-limited" }, { status: 429 });
  const raw = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (raw && typeof raw.memberId === "string" && raw.memberId !== auth.memberId) return Response.json({ error: "forbidden-member" }, { status: 403 });
  await deleteDoc(auth.familyId, "day_line", auth.memberId);
  return Response.json({ removed: true });
}
