// A line about today (SPEC: "Add to my day"). One short line a person puts on
// their own day ("At the temple with Papa"). It shows to the family until the
// end of the author's local day, then simply stops showing. No likes, no
// counts, no history: writing a new one replaces the old one.

export const DAY_LINE_MAX = 80;

/** The next local midnight in `tz` after `now`, as an ISO string. */
export function endOfLocalDay(tz: string, now: Date = new Date()): string {
  let h = 0;
  let m = 0;
  let s = 0;
  try {
    const parts = new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" }).formatToParts(now);
    const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
    h = get("hour");
    m = get("minute");
    s = get("second");
  } catch {
    h = now.getUTCHours();
    m = now.getUTCMinutes();
    s = now.getUTCSeconds();
  }
  const left = 86_400 - (h * 3600 + m * 60 + s);
  return new Date(Math.floor(now.getTime() / 1000) * 1000 + left * 1000).toISOString();
}

/** Lines still showing at `now`. */
export function liveLines<T extends { until: string }>(lines: T[], now = Date.now()): T[] {
  return lines.filter((l) => Date.parse(l.until) > now);
}

// Gentle write limit per person (it's one line; nobody needs more than this).
const WRITES_PER_MIN = 10;
const hits = new Map<string, number[]>();

export function allowDayLineWrite(key: string, now = Date.now()): boolean {
  const recent = (hits.get(key) ?? []).filter((t) => now - t < 60_000);
  if (recent.length >= WRITES_PER_MIN) {
    hits.set(key, recent);
    return false;
  }
  recent.push(now);
  hits.set(key, recent);
  return true;
}

/** Test-only. */
export function resetDayLineLimits(): void {
  hits.clear();
}
