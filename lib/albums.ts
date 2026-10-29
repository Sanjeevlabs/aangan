// Albums: Muse sorts photos into events (Apple Memories / Google Photos style),
// from what's visible and when it was taken. No face recognition: albums are
// about moments, never about recognising people. A person's fix always wins.
// Server only.
import { z } from "zod";
import { EVENT_KINDS } from "./kind-values";
import { listDocs, newId, putDoc } from "./family-docs";
import type { Album } from "./kinds";
import { museJson } from "./muse";
import type { Card } from "./schemas";

export type EventKind = (typeof EVENT_KINDS)[number];
/** Photos of the same kind of moment within this window are one event. */
export const EVENT_WINDOW_MS = 36 * 3_600_000;
const SORTED: EventKind[] = EVENT_KINDS.filter((e) => e !== "everyday");

export const EVENT_TITLE: Record<EventKind, string> = {
  wedding: "A wedding",
  ritual: "A puja at home",
  festival: "Festival days",
  birthday: "A birthday",
  gathering: "Everyone together",
  trip: "A trip",
  food: "Good food",
  nature: "Outdoors",
  school: "School days",
  everyday: "Everyday moments",
};

const KEYWORDS: [EventKind, RegExp][] = [
  // Generic, culture-neutral words only: festival and ritual specifics live in
  // ritual configs, never in logic.
  ["wedding", /(wedding|bride|groom|marriage|reception|शादी|दुल्हन|विवाह)/i],
  ["ritual", /(prayer|ceremony|blessing|worship|puja|pooja|पूजा|प्रार्थना)/i],
  ["festival", /(festival|festive|lamps?|lights|decorations?|त्योहार|दीये|सजावट)/i],
  ["birthday", /(birthday|cake|candles|जन्मदिन)/i],
  ["trip", /(trip|travel|beach|mountain|airport|station|journey|यात्रा)/i],
  ["food", /(food|dinner|lunch|breakfast|dal|roti|biryani|recipe|खाना)/i],
  ["school", /(school|class|uniform|exam|स्कूल)/i],
  ["nature", /(garden|park|river|tree|flowers?|sunset|बगीचा|नदी)/i],
  ["gathering", /(family|together|everyone|courtyard|आँगन|परिवार)/i],
];

/** Text-only guess (mock mode, and re-sorting older photos without a model). */
export function eventFromText(text: string): EventKind {
  return KEYWORDS.find(([, re]) => re.test(text))?.[0] ?? "everyday";
}

/**
 * File one photo/video into an album: join an event of the same kind within
 * the window, else start one. Everyday photos aren't filed (they live in the
 * Lane). Albums someone fixed by hand only grow if the photo clearly belongs.
 */
export async function fileCard(familyId: string, card: Pick<Card, "id" | "type" | "takenAt" | "caption">, event: EventKind): Promise<Album | null> {
  if (card.type === "audio" || !SORTED.includes(event)) return null;
  const at = Date.parse(card.takenAt);
  const albums = await listDocs(familyId, "album");
  if (albums.some((a) => a.cardIds.includes(card.id))) return albums.find((a) => a.cardIds.includes(card.id)) ?? null;
  const near = albums
    .filter((a) => a.event === event && at >= Date.parse(a.startAt) - EVENT_WINDOW_MS && at <= Date.parse(a.endAt) + EVENT_WINDOW_MS)
    .sort((a, b) => Math.abs(Date.parse(a.endAt) - at) - Math.abs(Date.parse(b.endAt) - at))[0];
  if (near) {
    return putDoc(familyId, "album", {
      ...near,
      cardIds: [...near.cardIds, card.id],
      startAt: new Date(Math.min(Date.parse(near.startAt), at)).toISOString(),
      endAt: new Date(Math.max(Date.parse(near.endAt), at)).toISOString(),
    });
  }
  return putDoc(familyId, "album", { id: newId("album"), title: EVENT_TITLE[event], event, cardIds: [card.id], startAt: card.takenAt, endAt: card.takenAt, coverId: card.id, madeBy: "muse", fixedBy: null, createdAt: new Date().toISOString() });
}

const TITLE_SYSTEM = [
  "Give a family photo album a short, warm title (max 6 words) from its photo captions. Reply with JSON only: {\"title\": str}.",
  "Use only names and details that appear in the captions. Never invent a name, place or occasion. If unsure, describe the moment plainly (\"A puja at home\").",
].join("\n");

/** Muse titles an album from its captions; names must come from the captions. */
export async function titleAlbum(familyId: string, album: Album, captions: string[], names: string[]): Promise<string> {
  if (album.fixedBy || captions.length < 2) return album.title;
  const known = new Set(names.map((n) => n.toLowerCase()));
  const out = await museJson({
    familyId,
    purpose: `Titled an album of ${captions.length} photos`,
    system: TITLE_SYSTEM,
    user: `Kind: ${album.event}\nCaptions:\n${captions.slice(0, 30).map((c) => `- ${c}`).join("\n")}`,
    schema: z.object({ title: z.string().min(2).max(80) }),
    mock: () => ({ title: mockTitle(album, captions, names) }),
    fallback: { title: album.title },
    maxTokens: 120,
    // Grounding: any capitalised word that looks like a name must be one we know.
    accept: (d) => d.title.split(/\s+/).filter((w) => /^[A-Z][a-z]+'?s?$/.test(w) && !/^(A|The|At|In|On|Of|And|Our|Home|Puja|Festival|Days|Everyone|Together|Wedding|Birthday|Good|Food|School|Trip|Outdoors|Morning|Evening|Night)$/.test(w.replace(/'s$/, ""))).every((w) => known.has(w.replace(/'s$/, "").toLowerCase())),
  });
  return out.data.title;
}

function mockTitle(album: Album, captions: string[], names: string[]): string {
  const name = names.find((n) => captions.some((c) => c.includes(n)));
  const base = EVENT_TITLE[album.event];
  if (name && (album.event === "wedding" || album.event === "birthday")) return `${name}'s ${album.event}`;
  return base;
}
