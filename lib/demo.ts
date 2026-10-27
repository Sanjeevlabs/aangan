import { CardSchema, type Card } from "./schemas";

// MOCK shelf content until M2 (real voice cards, transcripts, captions).
// Static, synthetic, and kept separate from the API-backed store so the swap
// is obvious. Deterministic peaks (LCG) so server and client render match.

function lcgPeaks(seed: number, n = 48): number[] {
  let s = seed;
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    const wave = 0.35 + 0.3 * Math.sin(i / 4);
    out.push(Math.min(1, Math.max(0.08, wave + (s % 1000) / 1000 / 2)));
  }
  return out.map((v) => Math.round(v * 100) / 100);
}

const RAW = [
  {
    id: "demo-from-dadi-1",
    familyId: "demo-family",
    type: "audio",
    caption: "सुबह की दुआ — आज का दिन अच्छा हो।",
    summary: "",
    lang: "hi",
    takenAt: "2026-10-27T06:30:00.000Z",
    ritualSlug: null,
    source: "upload",
    mediaRef: null,
    peaks: lcgPeaks(7),
    palette: ["#c96f4a", "#e8a87c", "#f4d8b4"],
  },
  {
    id: "demo-voice-1",
    familyId: "demo-family",
    type: "audio",
    caption: "Leo: the courtyard game, explained at full speed.",
    summary: "",
    lang: "en",
    takenAt: "2026-10-26T17:05:00.000Z",
    ritualSlug: null,
    source: "upload",
    mediaRef: null,
    peaks: lcgPeaks(21),
    palette: ["#7d8c6f", "#b3c1a5", "#e6e4d3"],
  },
  {
    id: "demo-voice-2",
    familyId: "demo-family",
    type: "audio",
    caption: "आरिया ने नया शब्द सुनाया।",
    summary: "",
    lang: "hi",
    takenAt: "2026-10-25T12:40:00.000Z",
    ritualSlug: null,
    source: "upload",
    mediaRef: null,
    peaks: lcgPeaks(42),
    palette: ["#a85d7a", "#d99ab0", "#f2d3da"],
  },
  {
    id: "demo-years-1",
    familyId: "demo-family",
    type: "photo",
    caption: "The old doorway, winter light.",
    summary: "",
    lang: "en",
    takenAt: "2021-10-27T09:15:00.000Z",
    ritualSlug: null,
    source: "upload",
    mediaRef: null,
    peaks: [],
    palette: ["#b0723a", "#d9a45b", "#f2ddae"],
  },
  {
    id: "demo-years-2",
    familyId: "demo-family",
    type: "photo",
    caption: "आँगन में धूप और चाय।",
    summary: "",
    lang: "hi",
    takenAt: "2019-10-27T08:00:00.000Z",
    ritualSlug: null,
    source: "upload",
    mediaRef: null,
    peaks: [],
    palette: ["#5f7f8c", "#93b3bd", "#d9e6e3"],
  },
] as const;

export const DEMO_SHELF_CARDS: Card[] = RAW.map((c) => CardSchema.parse(c));

export function demoShelf(id: "from-dadi" | "voices" | "years-ago"): Card[] {
  if (id === "from-dadi") return DEMO_SHELF_CARDS.filter((c) => c.id === "demo-from-dadi-1");
  if (id === "voices")
    return DEMO_SHELF_CARDS.filter((c) => c.id === "demo-voice-1" || c.id === "demo-voice-2");
  return DEMO_SHELF_CARDS.filter((c) => c.type === "photo");
}
