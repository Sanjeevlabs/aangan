// Around home: places that matter near a parent's home. Muse only suggests
// places the family already talks about (grounded in their own words); it
// never invents a place, and never pulls or stores map imagery.
import { z } from "zod";
import { PLACE_KINDS } from "./kind-values";
import { museJson } from "./muse";

export type PlaceKind = (typeof PLACE_KINDS)[number];

const WORDS: [PlaceKind, string, RegExp][] = [
  ["temple", "The temple", /(temple|mandir|मंदिर|gurdwara|church|mosque|masjid)/i],
  ["market", "The market", /(market|bazaar|sabzi|mandi|बाज़ार|मंडी|बाजार)/i],
  ["school", "The old school", /(school|स्कूल|पाठशाला)/i],
  ["park", "The park", /(park|garden|बगीचा|पार्क)/i],
  ["tea-stall", "The tea stall", /(tea stall|chai stall|chai wala|चाय की दुकान|टपरी)/i],
  ["station", "The station", /(station|स्टेशन|bus stand)/i],
  ["hospital", "The clinic", /(clinic|hospital|अस्पताल|दवाखाना)/i],
  ["other", "The river ghat", /(river|ghat|नदी|गंगा|घाट)/i],
  ["other", "The mela ground", /(mela|fair|मेला|मेले)/i],
];

export interface PlaceSuggestion {
  name: string;
  kind: PlaceKind;
  /** Where it came from, so the family can check ("4 voice notes"). */
  mentions: number;
  quote: string;
}

/** The words around the match, so the family sees why it was suggested. */
function around(text: string, re: RegExp): string {
  const m = re.exec(text);
  if (!m) return text.slice(0, 100);
  const start = Math.max(0, text.lastIndexOf(" ", Math.max(0, m.index - 36)) + 1);
  const end = Math.min(text.length, m.index + m[0].length + 60);
  return `${start > 0 ? "…" : ""}${text.slice(start, end).trim()}${end < text.length ? "…" : ""}`;
}

/** Deterministic: places named in the family's own captions and voices. */
export function suggestFromWords(texts: string[], existing: string[]): PlaceSuggestion[] {
  const have = existing.map((e) => e.toLowerCase());
  const out: PlaceSuggestion[] = [];
  for (const [kind, name, re] of WORDS) {
    const hits = texts.filter((t) => re.test(t));
    if (!hits.length || have.some((h) => re.test(h))) continue;
    const quote = around(hits[0], re);
    out.push({ name, kind, mentions: hits.length, quote });
  }
  return out.sort((a, b) => b.mentions - a.mentions).slice(0, 5);
}

const Schema = z.object({ places: z.array(z.object({ name: z.string().min(2).max(60), kind: z.enum(PLACE_KINDS), quote: z.string().max(160) })).max(6) });

export async function suggestPlaces(familyId: string, texts: string[], existing: string[]): Promise<PlaceSuggestion[]> {
  const base = suggestFromWords(texts, existing);
  if (texts.length === 0) return base;
  const joined = texts.join("\n");
  const out = await museJson({
    familyId,
    purpose: "Found places the family talks about near home",
    system: 'From these family voice notes and captions, list places near their home that they mention (temple, market, school, a friend\'s house, a tea stall…). JSON only: {"places": [{"name", "kind", "quote"}]}. kind is one of ' + PLACE_KINDS.join("|") + ". quote must be copied word for word from the text. Never invent a place.",
    user: texts.slice(0, 40).map((t) => `- ${t.slice(0, 300)}`).join("\n"),
    schema: Schema,
    mock: () => ({ places: base.map((b) => ({ name: b.name, kind: b.kind, quote: b.quote })) }),
    fallback: { places: base.map((b) => ({ name: b.name, kind: b.kind, quote: b.quote })) },
    maxTokens: 500,
    // Grounding: every quote must really be in what they said.
    accept: (d) => d.places.every((p) => joined.includes(p.quote.trim())),
  });
  const have = new Set(existing.map((e) => e.toLowerCase()));
  return out.data.places
    .filter((p) => !have.has(p.name.toLowerCase()))
    .map((p) => ({ ...p, mentions: texts.filter((t) => t.includes(p.quote.trim().slice(0, 12))).length || 1 }));
}
