// Pure date helpers for the Occasions room: which birthdays and kept
// festivals fall on which day. Client-safe (no fs). Festival specifics come
// from rituals/*.json via the API; nothing here names a festival.

export interface OccasionStep {
  key: string;
  kind: string;
  prompt: string;
  cardTemplate: string;
}
export interface OccasionConfig {
  slug: string;
  title: string;
  cultureNotes: string;
  steps: OccasionStep[];
}
export interface OccasionPerson {
  id: string;
  birthday?: string;
}
export interface CalOccasion {
  id: string;
  slug: string;
  /** YYYY-MM-DD */
  date: string;
  /** Festival title from its config; empty for birthdays (the page names the person). */
  title: string;
  memberId: string | null;
}

const DAY = 86_400_000;
const ISO = /^\d{4}-\d{2}-\d{2}$/;

/** "Birthday — family guide" → "Birthday". */
export function cleanTitle(title: string): string {
  return title.split(/\s+[—-]\s+/)[0].trim();
}

export function isoOf(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Today in the viewer's own zone. */
export function localTodayIso(now = new Date()): string {
  return isoOf(now);
}

function utc(iso: string): number {
  const [y, m, d] = iso.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}

export function addDays(iso: string, n: number): string {
  return new Date(utc(iso) + n * DAY).toISOString().slice(0, 10);
}

export function daysBetween(fromIso: string, toIso: string): number {
  return Math.round((utc(toIso) - utc(fromIso)) / DAY);
}

function birthdayIn(year: number, mmdd: string): string | null {
  if (!/^\d{2}-\d{2}$/.test(mmdd)) return null;
  const [m, d] = mmdd.split("-").map(Number);
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  const leap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
  // 29 Feb is kept on 28 Feb in other years.
  const day = m === 2 && d === 29 && !leap ? 28 : d;
  const dt = new Date(Date.UTC(year, m - 1, day));
  if (dt.getUTCMonth() !== m - 1) return null;
  return dt.toISOString().slice(0, 10);
}

/**
 * Every birthday and every KEPT festival between start and end (inclusive),
 * sorted by date. Birthdays always appear; a festival only when the family
 * chose to keep it and its date is known.
 */
export function occasionsInRange(
  members: OccasionPerson[],
  configs: Pick<OccasionConfig, "slug" | "title">[],
  movable: Record<string, string>,
  kept: string[],
  startIso: string,
  endIso: string,
): CalOccasion[] {
  if (!ISO.test(startIso) || !ISO.test(endIso) || endIso < startIso) return [];
  const out: CalOccasion[] = [];
  const y0 = Number(startIso.slice(0, 4));
  const y1 = Number(endIso.slice(0, 4));
  for (const m of members) {
    if (!m.birthday) continue;
    for (let y = y0; y <= y1; y++) {
      const date = birthdayIn(y, m.birthday);
      if (date && date >= startIso && date <= endIso) out.push({ id: `birthday:${m.id}:${date}`, slug: "birthday", date, title: "", memberId: m.id });
    }
  }
  const keep = new Set(kept);
  for (const c of configs) {
    if (c.slug === "birthday" || !keep.has(c.slug)) continue;
    const date = movable[c.slug];
    if (!date || !ISO.test(date) || date < startIso || date > endIso) continue;
    out.push({ id: `${c.slug}:${date}`, slug: c.slug, date, title: cleanTitle(c.title), memberId: null });
  }
  return out.sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
}

/** One month as calendar cells, weeks starting Sunday; only the weeks it needs. */
export function monthGrid(year: number, month0: number): { iso: string; day: number; inMonth: boolean }[] {
  const first = new Date(Date.UTC(year, month0, 1));
  const lead = first.getUTCDay();
  const days = new Date(Date.UTC(year, month0 + 1, 0)).getUTCDate();
  const total = Math.ceil((lead + days) / 7) * 7;
  const start = first.getTime() - lead * DAY;
  return Array.from({ length: total }, (_, i) => {
    const d = new Date(start + i * DAY);
    return { iso: d.toISOString().slice(0, 10), day: d.getUTCDate(), inMonth: d.getUTCMonth() === month0 };
  });
}

export function whenLabel(days: number, iso: string): string {
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  if (days < 7) return `In ${days} days`;
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });
}
