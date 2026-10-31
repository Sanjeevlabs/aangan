// Occasions (Celebrations → Occasions): the family's photos and voices from
// birthdays, weddings, anniversaries, festivals and other occasions, one group
// per occasion, newest first. Built from what is already there: wishes sent
// for an occasion's run, cards a ritual guide made (ritualSlug), and the albums
// Muse sorts whose event is an occasion. A group with nothing in it is left
// out. Every card an occasion claims (claimedByOccasions, same rules) stays
// out of Memory Lane, so nothing shows twice. Pure.
import type { Album } from "./kinds";
import type { Card, RitualRun, Wish } from "./schemas";

/** Album events that are occasions (the rest stay in Memory Lane). */
export const OCCASION_EVENTS: Album["event"][] = ["wedding", "ritual", "festival", "birthday"];

export function isOccasionAlbum(a: Pick<Album, "event">): boolean {
  return OCCASION_EVENTS.includes(a.event);
}

export interface OccasionGroup {
  key: string;
  title: string;
  /** Sort key and header date: YYYY-MM-DD (the occasion day, or the album's last day). */
  date: string;
  slug: string | null;
  albumId: string | null;
  runId: string | null;
  /** Photos and videos, oldest first (the order of the day). */
  prints: Card[];
  voices: Card[];
}

/** Days a guide's card may sit from the occasion day and still belong to it. */
const NEAR_DAYS = 2;

const day = (iso: string) => iso.slice(0, 10);
const apart = (a: string, b: string) => Math.abs(Date.parse(`${day(a)}T00:00:00Z`) - Date.parse(`${day(b)}T00:00:00Z`)) / 86_400_000;

export function occasionGroups(input: {
  cards: Card[];
  albums: Album[];
  runs: RitualRun[];
  /** Wishes with the card they were sent as. */
  wishes: Pick<Wish, "ritualRunId" | "cardId">[];
  /** The occasion's name for a slug on a day ("Maa's birthday", a festival's title). */
  titleFor: (slug: string, date: string) => string;
}): OccasionGroup[] {
  const byId = new Map(input.cards.map((c) => [c.id, c]));
  const used = new Set<string>();
  const groups: (Omit<OccasionGroup, "prints" | "voices"> & { cards: Card[] })[] = [];
  const take = (c: Card | undefined, into: Card[]) => {
    if (!c || used.has(c.id)) return;
    used.add(c.id);
    into.push(c);
  };

  // 1. Each occasion the family wished on: its wishes, and the guide's cards from that day.
  for (const run of [...input.runs].sort((a, b) => b.occasionDate.localeCompare(a.occasionDate))) {
    const cards: Card[] = [];
    for (const w of input.wishes) if (w.ritualRunId === run.id && w.cardId) take(byId.get(w.cardId), cards);
    for (const c of input.cards) if (c.ritualSlug === run.ritualSlug && apart(c.takenAt, run.occasionDate) <= NEAR_DAYS) take(c, cards);
    groups.push({ key: `run:${run.id}`, title: input.titleFor(run.ritualSlug, run.occasionDate), date: run.occasionDate, slug: run.ritualSlug, albumId: null, runId: run.id, cards });
  }

  // 2. A guide's cards with no run: one group per occasion and day (days close together merge).
  for (const c of [...input.cards].filter((x) => x.ritualSlug).sort((a, b) => b.takenAt.localeCompare(a.takenAt))) {
    if (used.has(c.id) || !c.ritualSlug) continue;
    let g = groups.find((x) => x.slug === c.ritualSlug && !x.albumId && apart(x.date, c.takenAt) <= NEAR_DAYS);
    if (!g) {
      g = { key: `slug:${c.ritualSlug}:${day(c.takenAt)}`, title: input.titleFor(c.ritualSlug, day(c.takenAt)), date: day(c.takenAt), slug: c.ritualSlug, albumId: null, runId: null, cards: [] };
      groups.push(g);
    }
    take(c, g.cards);
  }

  // 3. Albums Muse (or the family) sorted as an occasion.
  for (const a of input.albums.filter(isOccasionAlbum)) {
    const cards: Card[] = [];
    for (const id of a.cardIds) take(byId.get(id), cards);
    groups.push({ key: `album:${a.id}`, title: a.title, date: day(a.endAt), slug: null, albumId: a.id, runId: null, cards });
  }

  return groups
    .filter((g) => g.cards.length > 0)
    .map(({ cards, ...g }) => {
      const sorted = [...cards].sort((a, b) => a.takenAt.localeCompare(b.takenAt));
      return { ...g, prints: sorted.filter((c) => c.type !== "audio"), voices: sorted.filter((c) => c.type === "audio") };
    })
    .sort((a, b) => b.date.localeCompare(a.date) || a.key.localeCompare(b.key));
}

/** Every card Occasions shows, by the same rules as occasionGroups: Memory Lane leaves these out. */
export function claimedByOccasions(cards: Card[], albums: Album[], runs: RitualRun[], wishCards: Pick<Wish, "ritualRunId" | "cardId">[]): Set<string> {
  const groups = occasionGroups({ cards, albums, runs, wishes: wishCards, titleFor: (slug) => slug });
  return new Set(groups.flatMap((g) => [...g.prints, ...g.voices].map((c) => c.id)));
}
