import { readFileSync, readdirSync } from "fs";
import { join } from "path";
import { loadRitualConfig } from "@/lib/rituals";
import { dbListMembers, dbListRitualRuns } from "@/lib/db";

// Ritual calendar data: every config in rituals/*.json (never hard-coded in
// logic) + member birthdays from the family graph + movable-date fixture.
export async function GET(): Promise<Response> {
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
  let movable: Record<string, string> = {};
  try {
    const raw = JSON.parse(readFileSync(join(process.cwd(), "data", "movable-dates.json"), "utf8")) as {
      dates?: Record<string, string>;
    };
    movable = raw.dates ?? {};
  } catch {
    movable = {};
  }
  const [members, runs] = await Promise.all([dbListMembers(), dbListRitualRuns()]);
  return Response.json({ configs, movable, movableFixture: true, members, runs });
}
