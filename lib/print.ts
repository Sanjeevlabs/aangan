import type { Card, Member } from "./schemas";
import { placeFromTz } from "./zones";

// What's written in the white border of a printed photo: when, where and a
// note, in the sharer's hand. Pure helpers, shared by every framed view.

/** "Sat, 26 Oct · 7:40 AM" in the sharer's own time zone (where it was taken); the year too when it isn't this year. */
export function printWhen(iso: string, tz: string | null | undefined, now: Date = new Date()): string {
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return "";
  const zone = tz || "UTC";
  try {
    const parts = new Intl.DateTimeFormat("en-GB", { timeZone: zone, weekday: "short", day: "numeric", month: "short", year: "numeric" }).formatToParts(at);
    const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
    const thisYear = new Intl.DateTimeFormat("en-GB", { timeZone: zone, year: "numeric" }).format(now);
    const time = new Intl.DateTimeFormat("en-US", { timeZone: zone, hour: "numeric", minute: "2-digit" }).format(at);
    const year = get("year") === thisYear ? "" : ` ${get("year")}`;
    return `${get("weekday")}, ${get("day")} ${get("month")}${year} · ${time}`;
  } catch {
    return at.toISOString().slice(0, 10);
  }
}

/** Where: the place they wrote, else the sharer's home city, else nothing. */
export function printWhere(card: Pick<Card, "place">, author: Pick<Member, "city" | "tz"> | null | undefined): string {
  if (card.place?.trim()) return card.place.trim();
  if (!author) return "";
  if (author.city?.trim()) return author.city.trim();
  const fromTz = placeFromTz(author.tz);
  return fromTz === "Somewhere" ? "" : fromTz;
}

/** The note: what they wrote on the print, else the caption. */
export function printNote(card: Pick<Card, "note" | "caption">): string {
  return (card.note?.trim() || card.caption?.trim() || "").slice(0, 280);
}
