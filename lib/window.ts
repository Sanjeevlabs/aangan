// The window (LITE, SPEC §29.1): the first thing you see is the other home.
// For a son it opens onto his parents' home; for the parents, onto his.
// Pure helpers (client + server).
import { households, type Household } from "./households";
import type { Presence, WindowLayer } from "./kinds";
import type { Member, Relationship } from "./schemas";
import type { DayPhase, Weather } from "./weather";

/** The home on the other side of the window, or undefined if there's no one yet. */
export function farHomeFor(viewer: Member, members: Member[], relationships: Relationship[]): Household | undefined {
  const homes = households(members, relationships).filter((h) => !h.members.some((m) => m.id === viewer.id));
  if (viewer.role !== "elder") return homes.find((h) => h.elders) ?? homes[0];
  // A parent looks out to their own child's home first: the one the window
  // was set up for, not an in-law's or a cousin's.
  const mine = new Set(
    relationships
      .filter((r) => (r.canonicalKind === "parent" && r.relationMemberId === viewer.id) || (r.canonicalKind === "child" && r.memberId === viewer.id))
      .map((r) => (r.canonicalKind === "parent" ? r.memberId : r.relationMemberId)),
  );
  const own = homes.filter((h) => !h.elders && h.members.some((m) => mine.has(m.id)));
  // Several children: the one who wrote most recently would need cards; keep
  // it stable instead — the biggest home (often the one with grandchildren).
  return own.sort((a, b) => b.members.length - a.members.length)[0] ?? homes.find((h) => !h.elders) ?? homes[0];
}

/** The city a home lives in: the first member who said. */
export function cityOf(home: Household | undefined): string {
  return home?.members.find((m) => m.city)?.city ?? "";
}

const MOMENT_LAYER: Partial<Record<Presence["moment"], WindowLayer>> = {
  chai: "steam",
  cooking: "steam",
  "cooked-yours": "steam",
  garden: "leaves",
  walk: "birds",
  prayer: "lamp",
};

/**
 * The motion over the photo, from what is really true there now: their sky,
 * their hour, what they shared today. Muse may reorder or trim; it can never
 * add a layer that isn't grounded in one of these.
 */
export function groundedLayers(weather: Weather | null, phase: DayPhase, moments: Presence["moment"][]): WindowLayer[] {
  const out: WindowLayer[] = [];
  const add = (l: WindowLayer) => !out.includes(l) && out.push(l);
  if (weather?.kind === "rain" || weather?.kind === "storm") add("rain");
  if (weather?.kind === "clouds" || weather?.kind === "fog") add("clouds");
  if (phase === "night" && weather?.kind !== "rain" && weather?.kind !== "storm") add("stars");
  for (const m of [...moments].reverse()) {
    const l = MOMENT_LAYER[m];
    if (l) add(l);
  }
  if (phase === "dusk" || phase === "night") add("lamp");
  if (phase === "day" && out.length === 0) add("breeze");
  if (phase === "dawn") add("birds");
  return out.slice(0, 4);
}

/** A plain-words line when Muse isn't available: no invention, only what's true. */
export function plainLine(names: string, city: string, weather: Weather | null, latest: string | null): string {
  const sky = weather ? `${weather.label.toLowerCase()}, ${weather.tempC}°` : "";
  const where = [city, sky].filter(Boolean).join(" · ");
  return latest ? `${names}: ${latest}${where ? `. ${where}` : ""}` : where ? `${names} in ${where}` : names;
}
