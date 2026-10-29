import { z } from "zod";
import { requireSession } from "@/lib/auth";
import { dbListMembers } from "@/lib/db";
import { deleteDoc, getDoc, listDocs, newId, putDoc } from "@/lib/family-docs";
import { PresenceMomentSchema } from "@/lib/kinds";

// Presence: the moments a person shares about their day, and the parent-owned
// care settings. Only you can share your presence or change your settings.

const Share = z.object({ moment: PresenceMomentSchema, note: z.string().trim().max(120).default("") });
const Settings = z.object({
  quietAlert: z.boolean(),
  tellMemberId: z.string().min(1).nullable(),
  graceHours: z.number().int().min(1).max(12).default(3),
  shareVisits: z.boolean().default(true),
});

export async function GET(req: Request): Promise<Response> {
  const auth = await requireSession(req);
  if (auth instanceof Response) return auth;
  const since = Date.now() - 8 * 86_400_000; // a week of rhythm, for "usual"
  const [presence, settings] = await Promise.all([listDocs(auth.familyId, "presence"), listDocs(auth.familyId, "care_settings")]);
  return Response.json({ presence: presence.filter((p) => Date.parse(p.at) >= since), settings });
}

export async function POST(req: Request): Promise<Response> {
  const auth = await requireSession(req);
  if (auth instanceof Response) return auth;
  const parsed = Share.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "invalid-presence" }, { status: 400 });
  const now = new Date();
  if (parsed.data.moment === "here") {
    // Visits only count if the person allows it, and at most every 30 minutes.
    const mine = await getDoc(auth.familyId, "care_settings", auth.memberId);
    if (mine && !mine.shareVisits) return Response.json({ skipped: "visits-private" });
    const recent = (await listDocs(auth.familyId, "presence")).find((p) => p.memberId === auth.memberId && now.getTime() - Date.parse(p.at) < 30 * 60_000);
    if (recent) return Response.json({ skipped: "recent" });
  }
  const presence = await putDoc(auth.familyId, "presence", { id: newId("presence"), memberId: auth.memberId, moment: parsed.data.moment, note: parsed.data.note, at: now.toISOString() });
  return Response.json({ presence }, { status: 201 });
}

export async function PUT(req: Request): Promise<Response> {
  const auth = await requireSession(req);
  if (auth instanceof Response) return auth;
  const parsed = Settings.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "invalid-settings" }, { status: 400 });
  if (parsed.data.quietAlert && !parsed.data.tellMemberId) return Response.json({ error: "choose-someone" }, { status: 400 });
  if (parsed.data.tellMemberId) {
    const family = await dbListMembers(auth.familyId);
    if (!family.some((m) => m.id === parsed.data.tellMemberId && m.id !== auth.memberId)) return Response.json({ error: "unknown-member" }, { status: 400 });
  }
  const settings = await putDoc(auth.familyId, "care_settings", { id: auth.memberId, memberId: auth.memberId, ...parsed.data, updatedAt: new Date().toISOString() });
  return Response.json({ settings });
}

// Undo a moment you shared (only your own).
export async function DELETE(req: Request): Promise<Response> {
  const auth = await requireSession(req);
  if (auth instanceof Response) return auth;
  const parsed = z.object({ presenceId: z.string().min(1) }).safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "invalid-presence" }, { status: 400 });
  const p = await getDoc(auth.familyId, "presence", parsed.data.presenceId);
  if (!p) return Response.json({ error: "unknown-presence" }, { status: 404 });
  if (p.memberId !== auth.memberId) return Response.json({ error: "not-yours" }, { status: 403 });
  await deleteDoc(auth.familyId, "presence", p.id);
  return Response.json({ removed: p.id });
}
