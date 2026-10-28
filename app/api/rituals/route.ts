import { readFileSync, readdirSync } from "fs";
import { join } from "path";
import { loadRitualConfig } from "@/lib/rituals";
import { dbGetMovableDate, dbListMembers, dbListRitualRuns, dbSetMovableDate } from "@/lib/db";
import { resolveMovableDates } from "@/lib/movable-dates";
import { serverLedger, serverStore } from "@/lib/llm-server";
import { requireSession } from "@/lib/auth";

function readFixture(): Record<string, string> {
  try {
    const raw = JSON.parse(readFileSync(join(process.cwd(), "data", "movable-dates.json"), "utf8")) as {
      dates?: Record<string, string>;
    };
    return raw.dates ?? {};
  } catch {
    return {};
  }
}

// Ritual calendar data: every config in rituals/*.json (never hard-coded in
// logic) + member birthdays + movable dates resolved live per year via
// search grounding (cached; fixture only as fallback).
export async function GET(req: Request): Promise<Response> {
  const auth = requireSession(req);
  if (auth instanceof Response) return auth;
  const dir = join(process.cwd(), "rituals");
  const configs: { slug: string; title: string; cultureNotes: string; steps: unknown[] }[] = [];
  try {
    for (const name of readdirSync(dir)) {
      if (!name.endsWith(".json")) continue;
      const config = loadRitualConfig(JSON.parse(readFileSync(join(dir, name), "utf8")));
      configs.push({ slug: config.slug, title: config.title, cultureNotes: config.cultureNotes, steps: config.steps });
    }
  } catch {
    // Missing dir: calendar still shows birthdays.
  }
  const fixture = readFixture();
  const { dates: movable, grounded } = await resolveMovableDates(
    configs.filter((c) => c.slug !== "birthday"),
    new Date(),
    {
      store: serverStore,
      ledger: serverLedger,
      getPersistent: (slug, year) => dbGetMovableDate(slug, year),
      setPersistent: (slug, year, date, sources) => dbSetMovableDate(slug, year, date, sources),
      fixture: (slug) => fixture[slug] ?? null,
    },
  );
  const [members, runs] = await Promise.all([dbListMembers(auth.familyId), dbListRitualRuns(auth.familyId)]);
  return Response.json({ configs, movable, movableFixture: !grounded, members, runs });
}
