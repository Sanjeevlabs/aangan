// The view through the window when nobody has chosen a family photo: real
// landscape photographs that match the sky over the other home right now
// (their weather, their hour), shown as a slow slideshow like a lock-screen
// wallpaper. Photos: Unsplash (Unsplash License: free to use, no permission
// needed). Hotlinked from Unsplash's CDN, so nothing is stored or re-hosted.
import type { DayPhase, SkyKind } from "./weather";

export type SceneKey = "dawn" | "day" | "clouds" | "rain" | "fog" | "snow" | "dusk" | "night";

const U = (id: string) => `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=1400&q=78`;

export const SCENES: Record<SceneKey, string[]> = {
  dawn: ["1707730088436-0e55e78843d8", "1604223190546-a43e4c7f29d7", "1547710272-f0cd2545f838", "1700219799568-fd84f961b9eb"].map(U),
  day: ["1433883669848-fa8a7ce070b2", "1446488547543-78c11468449a", "1600337752115-de2c09d6704f", "1594595578536-b116414c5d2a", "1612441804231-77a36b284856"].map(U),
  clouds: ["1508930993032-fbbaf4f2821a", "1764167447343-b59bd9110fba", "1429081271179-49f13a9d4d99", "1584184087921-b397a56c13c3"].map(U),
  rain: ["1768984418057-fa55b2ddf4e1", "1781276366300-72e0d8539984", "1543251698-10f13f004b0f"].map(U),
  fog: ["1504252060324-1c76e2e09939", "1486707471592-8e7eb7e36f78", "1546421959-04f4f1c6ae94", "1535025075092-5a1cf795130b"].map(U),
  snow: ["1488164841856-b181b52ceb38", "1605153123052-528d89be0d4e"].map(U),
  dusk: ["1778177680336-1322ac583371", "1470252649378-9c29740c9fa8", "1760783319305-5f809038397f", "1542159919831-40fb0656b45a", "1494548162494-384bba4ab999"].map(U),
  night: ["1519681393784-d120267933ba", "1528353518104-dbd48bee7bc4", "1507400492013-162706c8c05e", "1518889735218-3e3a03fd3128", "1456530308602-976f6a4bb440"].map(U),
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
export function scenesFor(phase: DayPhase, sky: SkyKind | null, now = new Date()): string[] {
  const set = SCENES[sceneFor(phase, sky)];
  const start = Math.floor(now.getTime() / 86_400_000) % set.length;
  return [...set.slice(start), ...set.slice(0, start)];
}
