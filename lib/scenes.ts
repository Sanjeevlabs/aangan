// The view through the window: a living album. Real landscape photographs
// that match the sky over the other home right now (their weather, their
// hour), each with a line about what it shows, turning slowly like a lock
// screen; the family's own photos (with their captions) come round too.
// Landscapes: Unsplash (Unsplash License: free to use, no permission needed),
// hotlinked from Unsplash's CDN, so nothing is stored or re-hosted.
import type { DayPhase, SkyKind } from "./weather";

export type SceneKey = "dawn" | "day" | "clouds" | "rain" | "fog" | "snow" | "dusk" | "night";

export interface Scene {
  src: string;
  /** What the photo shows, in a few words. Never a made-up place name. */
  title: string;
}

const U = (id: string) => `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=1400&q=78`;
const s = (id: string, title: string): Scene => ({ src: U(id), title });

export const SCENES: Record<SceneKey, Scene[]> = {
  dawn: [
    s("1707730088436-0e55e78843d8", "First light breaking over the hills"),
    s("1604223190546-a43e4c7f29d7", "Ridge after ridge in the early glow"),
    s("1547710272-f0cd2545f838", "Mountains waking in blue and gold"),
    s("1700219799568-fd84f961b9eb", "A quiet valley before the day begins"),
  ],
  day: [
    s("1433883669848-fa8a7ce070b2", "A green valley under an open sky"),
    s("1446488547543-78c11468449a", "Wheat fields at the foot of the pines"),
    s("1600337752115-de2c09d6704f", "Meadow and mountain on a clear day"),
    s("1594595578536-b116414c5d2a", "Still water by a grassy field"),
    s("1612441804231-77a36b284856", "Green mountains under a bright sky"),
  ],
  clouds: [
    s("1508930993032-fbbaf4f2821a", "Wide plains beneath a cloudy sky"),
    s("1764167447343-b59bd9110fba", "Rolling green hills, clouds drifting over"),
    s("1429081271179-49f13a9d4d99", "Brown hills under a heavy sky"),
    s("1584184087921-b397a56c13c3", "Green fields and soft white clouds"),
  ],
  rain: [
    s("1768984418057-fa55b2ddf4e1", "Rain on the glass, flowers and hills beyond"),
    s("1781276366300-72e0d8539984", "Raindrops on the pane, green outside"),
    s("1543251698-10f13f004b0f", "A window onto wet green trees"),
  ],
  fog: [
    s("1504252060324-1c76e2e09939", "A mountain wrapped in fog"),
    s("1486707471592-8e7eb7e36f78", "A grey forest lost in mist"),
    s("1546421959-04f4f1c6ae94", "Mist rolling over the slopes"),
    s("1535025075092-5a1cf795130b", "Trees half-hidden in the morning fog"),
  ],
  snow: [
    s("1488164841856-b181b52ceb38", "Pines heavy with fresh snow"),
    s("1605153123052-528d89be0d4e", "A small house below the snowy peaks"),
  ],
  dusk: [
    s("1778177680336-1322ac583371", "Pink and violet over the hills at dusk"),
    s("1470252649378-9c29740c9fa8", "Trees against an evening sky"),
    s("1760783319305-5f809038397f", "The last orange light on the mountains"),
    s("1542159919831-40fb0656b45a", "The sun going down over the ridges"),
    s("1494548162494-384bba4ab999", "Sunset at the edge of the world"),
  ],
  night: [
    s("1519681393784-d120267933ba", "Snow peaks under a sky full of stars"),
    s("1528353518104-dbd48bee7bc4", "The Milky Way above the mountains"),
    s("1507400492013-162706c8c05e", "A clear night, every star out"),
    s("1518889735218-3e3a03fd3128", "Looking up through the trees at the stars"),
    s("1456530308602-976f6a4bb440", "Mountains and clouds by night"),
  ],
};

/** Night and twilight win over weather (a rainy night is still night); then the sky. */
export function sceneFor(phase: DayPhase, sky: SkyKind | null): SceneKey {
  if (sky === "rain" || sky === "storm") return phase === "night" ? "night" : "rain";
  if (phase === "night") return "night";
  if (sky === "snow") return "snow";
  if (sky === "fog") return "fog";
  if (phase === "dawn") return "dawn";
  if (phase === "dusk") return "dusk";
  return sky === "clouds" ? "clouds" : "day";
}

/** The day's order: rotate the set so each day opens on a different photo. */
export function scenesFor(phase: DayPhase, sky: SkyKind | null, now = new Date()): Scene[] {
  const set = SCENES[sceneFor(phase, sky)];
  const start = Math.floor(now.getTime() / 86_400_000) % set.length;
  return [...set.slice(start), ...set.slice(0, start)];
}

export interface AlbumSlide {
  src: string;
  title: string;
  /** "Maa · 2025" for a family photo; empty for a landscape. */
  by: string;
  family: boolean;
}

/** The living album: the sky's photos, with a family photo every third slide. */
export function livingAlbum(scenes: Scene[], family: { src: string; title: string; by: string }[]): AlbumSlide[] {
  const out: AlbumSlide[] = [];
  const fam = [...family];
  scenes.forEach((sc, i) => {
    out.push({ ...sc, by: "", family: false });
    if (i % 2 === 1 && fam.length) out.push({ ...fam.shift()!, family: true });
  });
  return [...out, ...fam.map((f) => ({ ...f, family: true }))];
}
