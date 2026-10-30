// Memory Lane grouping: same kind of thing together (photos, videos,
// voices), newest first, each with a small timeline cue. Client-safe.
import type { Card } from "./schemas";

export type LaneKind = "photo" | "video" | "audio";

export const LANE_ROWS: { kind: LaneKind; title: string; one: string; many: string }[] = [
  { kind: "photo", title: "Photos", one: "photo", many: "photos" },
  { kind: "video", title: "Videos", one: "video", many: "videos" },
  { kind: "audio", title: "Voice notes", one: "voice note", many: "voice notes" },
];

function valid(iso: string): Date | null {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** "Oct 26" on a tile. */
export function monthChip(iso: string): string {
  const d = valid(iso);
  if (!d) return "Undated";
  return `${d.toLocaleDateString("en-US", { month: "short" })} ’${String(d.getFullYear()).slice(2)}`;
}

/** "Oct 2026 → 2019" for a row (cards newest first). */
export function rangeLabel(cards: Pick<Card, "takenAt">[]): string {
  const dates = cards.map((c) => valid(c.takenAt)).filter((d): d is Date => d !== null);
  if (!dates.length) return "";
  const newest = dates.reduce((a, b) => (b > a ? b : a));
  const oldest = dates.reduce((a, b) => (b < a ? b : a));
  const head = newest.toLocaleDateString("en-US", { month: "short", year: "numeric" });
  if (newest.getFullYear() === oldest.getFullYear()) {
    const tail = oldest.toLocaleDateString("en-US", { month: "short" });
    return tail === newest.toLocaleDateString("en-US", { month: "short" }) ? head : `${head} → ${tail}`;
  }
  return `${head} → ${oldest.getFullYear()}`;
}

/** Cards split by kind, newest first, optionally only one person's. */
export function laneGroups(cards: Card[], who: string | null): Record<LaneKind, Card[]> {
  const out: Record<LaneKind, Card[]> = { photo: [], video: [], audio: [] };
  const list = [...cards].sort((a, b) => b.takenAt.localeCompare(a.takenAt));
  for (const c of list) {
    if (who && c.authorId !== who) continue;
    out[c.type].push(c);
  }
  return out;
}
