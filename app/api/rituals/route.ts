import { z } from "zod";
import { isGrownUp } from "@/lib/permissions";
import { checkRateLimit, requireSession } from "@/lib/auth";
import { dbEnsureRitualRun, dbGetMember, dbListMembers, dbListRitualRuns, dbListWishes } from "@/lib/db";
import { countryName, traditionChoices, TRADITIONS_DATA } from "@/lib/holidays";
import { setRitualSettings } from "@/lib/occasion-settings";
import { familyHolidays, ritualConfigs } from "@/lib/occasions-server";
import { addDays, occasionsInRange } from "@/lib/occasion-calendar";

// Occasions data: member birthdays, national days, and the festivals of the
// traditions this family celebrates (Google's public holiday calendar for
// the family's country, mapped by data/traditions.json; bundled fallback).
// The traditions choice is one family-level list, used only for the calendar.
export async function GET(req: Request): Promise<Response> {
  const auth = await requireSession(req);
  if (auth instanceof Response) return auth;
  const [members, me] = await Promise.all([dbListMembers(auth.familyId), dbGetMember(auth.memberId)]);
  const fam = await familyHolidays(auth.familyId, members);
  // Open a run (idempotent) for each wishable occasion in the next 10 days,
  // so a wish recorded early lands on the right day's garland.
  const today = new Date().toISOString().slice(0, 10);
  const festivals = fam.visible.filter((h) => h.kind === "festival");
  for (const o of occasionsInRange(members, festivals, today, addDays(today, 10))) {
    await dbEnsureRitualRun(o.slug, o.date, auth.familyId).catch(() => undefined);
  }
  const runs = await dbListRitualRuns(auth.familyId);
  // Wishes for runs of the last few weeks, so "everyone wished" shows on the day.
  const cutoff = new Date(Date.now() - 21 * 86_400_000).toISOString().slice(0, 10);
  const recentRuns = new Set(runs.filter((r) => r.occasionDate >= cutoff).map((r) => r.id));
  const allWishes = runs.length ? await dbListWishes(undefined, auth.familyId) : [];
  const wishes = allWishes.filter((w) => w.ritualRunId && recentRuns.has(w.ritualRunId));
  // Every wish sent as a photo or voice, for the occasions album (Celebrations → Occasions).
  const wishCards = allWishes.filter((w) => w.ritualRunId && w.cardId).map((w) => ({ ritualRunId: w.ritualRunId, cardId: w.cardId }));
  const canEdit = Boolean(me && me.familyId === auth.familyId && isGrownUp(me));
  return Response.json({
    configs: ritualConfigs(),
    holidays: fam.all,
    holidaySource: fam.source,
    country: fam.country,
    countryName: countryName(fam.country),
    traditionChoices: traditionChoices(),
    traditions: fam.settings.traditions,
    kept: fam.settings.kept,
    skipped: fam.settings.skipped,
    members,
    runs,
    wishes,
    wishCards,
    canEditKept: canEdit,
  });
}

const Keys = z.array(z.string().min(1).max(60)).max(40);
const SetKept = z.object({ action: z.literal("kept"), kept: Keys, skipped: Keys.optional() });
const SetTraditions = z.object({ action: z.literal("traditions"), traditions: z.array(z.string().min(1).max(30)).max(12), kept: Keys.optional(), skipped: Keys.optional() });
const Body = z.discriminatedUnion("action", [SetKept, SetTraditions]);

// Change the family's traditions and per-festival overrides. Admins and
// members only (not child accounts).
export async function POST(req: Request): Promise<Response> {
  const auth = await requireSession(req);
  if (auth instanceof Response) return auth;
  if (!checkRateLimit(auth, "/api/rituals")) return Response.json({ error: "rate-limited" }, { status: 429 });
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "invalid-request" }, { status: 400 });
  const me = await dbGetMember(auth.memberId);
  if (!me || me.familyId !== auth.familyId) return Response.json({ error: "unknown-member" }, { status: 404 });
  if (!isGrownUp(me)) return Response.json({ error: "not-allowed" }, { status: 403 });
  const body = parsed.data;
  // Override keys: any holiday key from data/traditions.json or a ritual config slug (not birthdays).
  const known = new Set([...TRADITIONS_DATA.patterns.map((p) => p.key), ...ritualConfigs().map((c) => c.slug)].filter((s) => s !== "birthday"));
  const unknown = [...(body.kept ?? []), ...(body.skipped ?? [])].filter((s) => !known.has(s));
  if (unknown.length) return Response.json({ error: "unknown-festival", unknown }, { status: 400 });
  let traditions: string[] | undefined;
  if (body.action === "traditions") {
    const choices = traditionChoices();
    const bad = body.traditions.filter((t) => !choices.some((c) => c.id === t));
    if (bad.length) return Response.json({ error: "unknown-tradition", unknown: bad }, { status: 400 });
    // An exclusive choice ("none") stands alone.
    const exclusive = body.traditions.find((t) => choices.find((c) => c.id === t)?.exclusive);
    traditions = exclusive ? [exclusive] : body.traditions;
  }
  const settings = await setRitualSettings(auth.familyId, { traditions, kept: body.kept, skipped: body.skipped }, auth.memberId);
  return Response.json({ traditions: settings.traditions, kept: settings.kept, skipped: settings.skipped });
}
