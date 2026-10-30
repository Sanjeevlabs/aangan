// Occasions, server side: ritual configs from rituals/*.json (data, never
// logic), member birthdays, and only the festivals this family chose to
// keep. Birthdays always count. Server only.
import { readFileSync, readdirSync } from "fs";
import { join } from "path";
import { daysUntilBirthday } from "./family";
import { cleanTitle, type OccasionConfig } from "./occasion-calendar";
import { keptFestivals } from "./occasion-settings";
import { loadRitualConfig } from "./rituals";
import type { Member } from "./schemas";

export interface Occasion {
  slug: string;
  title: string;
  date: string;
  days: number;
  memberId: string | null;
}

export function fixtureDates(): Record<string, string> {
  try {
    return (JSON.parse(readFileSync(join(process.cwd(), "data", "movable-dates.json"), "utf8")) as { dates?: Record<string, string> }).dates ?? {};
  } catch {
    return {};
  }
}

/** Every valid config in rituals/*.json; a bad file is skipped, not fatal. */
export function ritualConfigs(): OccasionConfig[] {
  const dir = join(process.cwd(), "rituals");
  let names: string[] = [];
  try {
    names = readdirSync(dir).filter((n) => n.endsWith(".json")).sort();
  } catch {
    return [];
  }
  const out: OccasionConfig[] = [];
  for (const n of names) {
    try {
      const c = loadRitualConfig(JSON.parse(readFileSync(join(dir, n), "utf8")));
      out.push({ slug: c.slug, title: c.title, cultureNotes: c.cultureNotes, steps: c.steps });
    } catch {
      console.error("[occasions] skipped invalid ritual config", n);
    }
  }
  return out;
}

/** Festivals a family can choose from (every config except birthdays). */
export function festivalChoices(): { slug: string; title: string; note: string }[] {
  return ritualConfigs()
    .filter((c) => c.slug !== "birthday")
    .map((c) => ({ slug: c.slug, title: cleanTitle(c.title), note: c.cultureNotes }));
}

/**
 * The next occasion inside `within` days. Festivals appear only when their
 * slug is in `kept` (the family's own choice); default none = birthdays only.
 */
export function nextOccasion(members: Member[], now = new Date(), within = 30, kept: string[] = []): Occasion | null {
  const start = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const out: Occasion[] = [];
  const dates = fixtureDates();
  const keep = new Set(kept);
  for (const f of festivalChoices()) {
    if (!keep.has(f.slug)) continue;
    const d = dates[f.slug];
    if (!d) continue;
    const days = Math.round((Date.parse(`${d}T00:00:00Z`) - start) / 86_400_000);
    if (days >= 0) out.push({ slug: f.slug, title: f.title, date: d, days, memberId: null });
  }
  for (const m of members) {
    const days = daysUntilBirthday(m.birthday, now);
    if (!Number.isFinite(days)) continue;
    const d = new Date(start + days * 86_400_000).toISOString().slice(0, 10);
    out.push({ slug: "birthday", title: `${m.displayName || m.firstName}'s birthday`, date: d, days, memberId: m.id });
  }
  return out.filter((o) => o.days <= within).sort((a, b) => a.days - b.days)[0] ?? null;
}

/** nextOccasion with the family's kept festivals looked up. */
export async function nextOccasionFor(familyId: string, members: Member[], now = new Date(), within = 30): Promise<Occasion | null> {
  return nextOccasion(members, now, within, await keptFestivals(familyId));
}
