// "Muse made this for you": at most one quiet card in the family page's
// "Now in the family" row. It rotates weekly between what Muse can offer
// from things that really happened, and a dismissal hides it for two weeks.
// Pure, client-safe; the dismissal itself lives in the viewer's browser.
import type { Card } from "./schemas";

export const SLOT_DISMISS_KEY = "aangan:muse-slot:dismissed";
export const SLOT_QUIET_DAYS = 14;
const DAY = 86_400_000;

export type MuseSlot = { kind: "portrait" } | { kind: "this-day"; card: Card; years: number };

/** ISO week number since the epoch: the slot changes once a week, the same for everyone. */
export function weekIndex(now: Date): number {
  return Math.floor((now.getTime() / DAY + 3) / 7);
}

export function isQuiet(dismissedAt: string | null | undefined, now: Date): boolean {
  if (!dismissedAt) return false;
  const t = Date.parse(dismissedAt);
  return Number.isFinite(t) && now.getTime() - t < SLOT_QUIET_DAYS * DAY;
}

/** A photo taken within a day of today's date in an earlier year (the newest such year wins). */
export function thisDayCard(cards: Card[], now: Date): { card: Card; years: number } | null {
  let best: { card: Card; years: number } | null = null;
  for (const c of cards) {
    if (c.type !== "photo") continue;
    const d = new Date(c.takenAt);
    const years = now.getFullYear() - d.getFullYear();
    if (years < 1) continue;
    const same = new Date(now.getFullYear(), d.getMonth(), d.getDate());
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    if (Math.abs(same.getTime() - today.getTime()) > DAY) continue;
    if (!best || years < best.years) best = { card: c, years };
  }
  return best;
}

/** One line from what is on the card itself: never an invented memory. */
export function thisDayNote(card: Card, years: number): string {
  const what = (card.note || card.caption).trim().replace(/[.!]+$/, "");
  const when = `${years} year${years === 1 ? "" : "s"} ago today`;
  return what ? `${when}: ${what}.` : `${when}, in your family's photos.`;
}

export function pickMuseSlot(input: { now: Date; dismissedAt: string | null; canPortrait: boolean; portraitPeople: number; cards: Card[] }): MuseSlot | null {
  if (isQuiet(input.dismissedAt, input.now)) return null;
  const offers: MuseSlot[] = [];
  if (input.canPortrait && input.portraitPeople >= 2) offers.push({ kind: "portrait" });
  const day = thisDayCard(input.cards, input.now);
  if (day) offers.push({ kind: "this-day", ...day });
  if (offers.length === 0) return null;
  return offers[weekIndex(input.now) % offers.length];
}
