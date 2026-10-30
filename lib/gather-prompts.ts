// In-app prompts for family events (there is no push yet): "Join Dadi's
// birthday get-together: pick a time", "Starts in 1 hour", and Muse's
// auto-suggestion 10 days before a birthday or a festival the family keeps.
// Computed on read from events + occasions, so nothing to clean up. Pure.
import { isLive, lockedStart, occasionEventKey, participants, startsInLabel, typeForOccasion, type EventType, type FamilyEvent } from "./events";

export interface UpcomingOccasion {
  /** occasionEventKey: one event per occasion per date. */
  key: string;
  slug: string;
  kind: "birthday" | "festival" | "national";
  type: EventType;
  date: string;
  days: number;
  /** "Maa's birthday", or the festival's name. */
  label: string;
  memberId: string | null;
}

export type EventPrompt =
  | { id: string; kind: "pick"; text: string; eventId: string }
  | { id: string; kind: "soon" | "live"; text: string; eventId: string }
  | { id: string; kind: "suggest"; text: string; occasion: UpcomingOccasion };

/** Days before an occasion when Muse offers to plan it. */
export const SUGGEST_DAYS = 10;

export function upcomingOccasion(o: { slug: string; kind: "birthday" | "festival" | "national"; date: string; title: string; memberId: string | null }, days: number, nameOf: (id: string) => string): UpcomingOccasion {
  const label = o.kind === "birthday" && o.memberId ? `${nameOf(o.memberId)}'s birthday` : o.title;
  return { key: occasionEventKey(o.slug, o.date, o.memberId), slug: o.slug, kind: o.kind, type: typeForOccasion(o.slug, o.kind), date: o.date, days, label, memberId: o.memberId };
}

export function suggestText(o: UpcomingOccasion): string {
  return o.kind === "birthday" ? `Plan ${o.label} get-together?` : `Plan a ${o.label} get-together?`;
}

export function buildPrompts(input: {
  viewerId: string;
  /** Children are invited but never asked to organise. */
  canPlan: boolean;
  events: FamilyEvent[];
  occasions: UpcomingOccasion[];
  dismissed: string[];
  now?: Date;
}): EventPrompt[] {
  const now = input.now ?? new Date();
  const out: EventPrompt[] = [];
  const active = input.events.filter((e) => e.status !== "cancelled");
  for (const e of active) {
    if (!participants(e).includes(input.viewerId)) continue;
    if (e.status === "voting" && e.slots.length > 0 && !e.answered.includes(input.viewerId)) {
      out.push({ id: `pick:${e.id}`, kind: "pick", text: `Join ${e.title}: pick a time`, eventId: e.id });
    }
    const start = lockedStart(e);
    if (e.status === "locked" && start) {
      if (isLive(e, now)) out.push({ id: `live:${e.id}`, kind: "live", text: `${e.title} · Live now`, eventId: e.id });
      else {
        const mins = (start.getTime() - now.getTime()) / 60_000;
        if (mins > 0 && mins <= 90) out.push({ id: `soon:${e.id}`, kind: "soon", text: `${e.title} · ${startsInLabel(start, now)}`, eventId: e.id });
      }
    }
  }
  if (input.canPlan) {
    const planned = new Set(active.map((e) => occasionEventKey(e.occasionKey, e.date, e.forMemberId)));
    const next = input.occasions
      .filter((o) => (o.kind === "birthday" || o.kind === "festival") && o.days >= 1 && o.days <= SUGGEST_DAYS)
      .filter((o) => o.memberId !== input.viewerId && !planned.has(o.key) && !input.dismissed.includes(`suggest:${o.key}`))
      .sort((a, b) => a.days - b.days)[0];
    if (next) out.push({ id: `suggest:${next.key}`, kind: "suggest", text: suggestText(next), occasion: next });
  }
  const rank = { live: 0, soon: 1, pick: 2, suggest: 3 } as const;
  return out.sort((a, b) => rank[a.kind] - rank[b.kind]);
}
