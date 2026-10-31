import { z } from "zod";
import { checkRateLimit, requireSession } from "@/lib/auth";
import { dbEnsureRitualRun, dbGetMember, dbGetMovableDate, dbListMembers, dbListRitualRuns, dbListWishes, dbSetMovableDate } from "@/lib/db";
import { serverLedger, serverStore } from "@/lib/llm-server";
import { resolveMovableDates } from "@/lib/movable-dates";
import { getRitualSettings, setKeptFestivals } from "@/lib/occasion-settings";
import { fixtureDates, ritualConfigs } from "@/lib/occasions-server";
import { addDays, occasionsInRange } from "@/lib/occasion-calendar";

// Occasions data: every config in rituals/*.json (never hard-coded in
// logic), member birthdays, the festivals THIS family keeps, and movable
// dates (resolved live per year via search grounding, cached; fixture only
// as fallback) for the kept festivals only. Nothing about anyone's faith is
// stored: "festivals we keep" is one family-level list of config slugs.
export async function GET(req: Request): Promise<Response> {
  const auth = await requireSession(req);
  if (auth instanceof Response) return auth;
  const configs = ritualConfigs();
  const [settings, members, me] = await Promise.all([getRitualSettings(auth.familyId), dbListMembers(auth.familyId), dbGetMember(auth.memberId)]);
  const known = new Set(configs.map((c) => c.slug));
  const kept = settings.kept.filter((s) => known.has(s) && s !== "birthday");
  const fixture = fixtureDates();
  const { dates: movable, grounded } = await resolveMovableDates(
    configs.filter((c) => kept.includes(c.slug)).map((c) => ({ slug: c.slug, title: c.title })),
    new Date(),
    {
      store: serverStore,
      ledger: serverLedger,
      getPersistent: (slug, year) => dbGetMovableDate(slug, year),
      setPersistent: (slug, year, date, sources) => dbSetMovableDate(slug, year, date, sources),
      fixture: (slug) => fixture[slug] ?? null,
    },
  );
  // Open a run (idempotent) for each occasion in the next 10 days, so a wish
  // recorded early lands on the right day's reel.
  const today = new Date().toISOString().slice(0, 10);
  for (const o of occasionsInRange(members, configs, movable, kept, today, addDays(today, 10))) {
    await dbEnsureRitualRun(o.slug, o.date, auth.familyId).catch(() => undefined);
  }
  const runs = await dbListRitualRuns(auth.familyId);
  // Wishes for runs of the last few weeks, so "everyone wished" shows on the day.
  const cutoff = new Date(Date.now() - 21 * 86_400_000).toISOString().slice(0, 10);
  const recentRuns = new Set(runs.filter((r) => r.occasionDate >= cutoff).map((r) => r.id));
  const wishes = recentRuns.size ? (await dbListWishes(undefined, auth.familyId)).filter((w) => w.ritualRunId && recentRuns.has(w.ritualRunId)) : [];
  return Response.json({
    configs,
    movable,
    movableFixture: !grounded,
    members,
    runs,
    wishes,
    kept,
    canEditKept: Boolean(me && me.familyId === auth.familyId && me.access !== "child"),
  });
}

const SetKept = z.object({ action: z.literal("kept"), kept: z.array(z.string().min(1).max(60)).max(40) });

// Change "festivals we keep". Admins and members only (not child accounts).
export async function POST(req: Request): Promise<Response> {
  const auth = await requireSession(req);
  if (auth instanceof Response) return auth;
  if (!checkRateLimit(auth, "/api/rituals")) return Response.json({ error: "rate-limited" }, { status: 429 });
  const parsed = SetKept.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "invalid-request" }, { status: 400 });
  const me = await dbGetMember(auth.memberId);
  if (!me || me.familyId !== auth.familyId) return Response.json({ error: "unknown-member" }, { status: 404 });
  if (me.access === "child") return Response.json({ error: "not-allowed" }, { status: 403 });
  const known = new Set(ritualConfigs().map((c) => c.slug).filter((s) => s !== "birthday"));
  const unknown = parsed.data.kept.filter((s) => !known.has(s));
  if (unknown.length) return Response.json({ error: "unknown-festival", unknown }, { status: 400 });
  const settings = await setKeptFestivals(auth.familyId, parsed.data.kept, auth.memberId);
  return Response.json({ kept: settings.kept });
}
