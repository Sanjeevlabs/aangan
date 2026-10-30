// The next occasion both homes should gather photos for: a festival from
// rituals/*.json (data, never logic) or a family birthday. Server only.
import { readFileSync, readdirSync } from "fs";
import { join } from "path";
import { daysUntilBirthday } from "./family";
import type { Member } from "./schemas";

export interface Occasion {
  slug: string;
  title: string;
  date: string;
  days: number;
  memberId: string | null;
}

function fixtureDates(): Record<string, string> {
  try {
    return (JSON.parse(readFileSync(join(process.cwd(), "data", "movable-dates.json"), "utf8")) as { dates?: Record<string, string> }).dates ?? {};
  } catch {
    return {};
  }
}

function festivals(): { slug: string; title: string }[] {
  try {
    return readdirSync(join(process.cwd(), "rituals"))
      .filter((n) => n.endsWith(".json"))
      .map((n) => JSON.parse(readFileSync(join(process.cwd(), "rituals", n), "utf8")) as { slug: string; title: string })
      .filter((c) => c.slug !== "birthday")
      .map((c) => ({ slug: c.slug, title: c.title.split(" — ")[0] }));
  } catch {
    return [];
  }
}

export function nextOccasion(members: Member[], now = new Date(), within = 30): Occasion | null {
  const start = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const out: Occasion[] = [];
  const dates = fixtureDates();
  for (const f of festivals()) {
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
