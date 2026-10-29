// The sky over the other home: their weather and time of day, so the window
// feels like it opens onto *now* where they are. Pure helpers (client + server)
// plus a server fetch from Open-Meteo (free, no key). Only a city name ever
// leaves the server; nobody's location is tracked.

export type SkyKind = "clear" | "clouds" | "fog" | "rain" | "storm" | "snow";
export type DayPhase = "dawn" | "day" | "dusk" | "night";

export interface Weather {
  city: string;
  tempC: number;
  kind: SkyKind;
  /** "Light rain", "Clear" — words, never an icon alone. */
  label: string;
  source: "open-meteo" | "mock";
  at: string;
}

/** WMO weather code → our six skies (https://open-meteo.com/en/docs). */
export function skyFromWmo(code: number): { kind: SkyKind; label: string } {
  if (code === 0) return { kind: "clear", label: "Clear" };
  if (code <= 2) return { kind: "clouds", label: "Partly cloudy" };
  if (code === 3) return { kind: "clouds", label: "Cloudy" };
  if (code === 45 || code === 48) return { kind: "fog", label: "Foggy" };
  if (code >= 51 && code <= 57) return { kind: "rain", label: "Drizzle" };
  if (code >= 61 && code <= 67) return { kind: "rain", label: code === 61 ? "Light rain" : "Rain" };
  if (code >= 71 && code <= 77) return { kind: "snow", label: "Snow" };
  if (code >= 80 && code <= 82) return { kind: "rain", label: "Showers" };
  if (code >= 85 && code <= 86) return { kind: "snow", label: "Snow showers" };
  if (code >= 95) return { kind: "storm", label: "Thunderstorm" };
  return { kind: "clouds", label: "Cloudy" };
}

export function phaseFor(hour: number): DayPhase {
  if (hour >= 5 && hour < 7.5) return "dawn";
  if (hour >= 7.5 && hour < 17) return "day";
  if (hour >= 17 && hour < 19.5) return "dusk";
  return "night";
}

/** The light over the photo: a tint that follows their clock. */
export const PHASE_TINT: Record<DayPhase, { top: string; bottom: string; lamp: boolean }> = {
  dawn: { top: "rgba(255,170,120,.38)", bottom: "rgba(255,214,170,.10)", lamp: false },
  day: { top: "rgba(150,200,255,.10)", bottom: "rgba(255,255,255,0)", lamp: false },
  dusk: { top: "rgba(250,120,70,.42)", bottom: "rgba(90,40,90,.25)", lamp: true },
  night: { top: "rgba(8,14,40,.72)", bottom: "rgba(10,10,30,.45)", lamp: true },
};

/** Deterministic stand-in so the demo and tests never need the network. */
export function mockWeather(city: string, now = new Date()): Weather {
  let h = 0;
  for (const ch of city.toLowerCase()) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const day = Math.floor(now.getTime() / 86_400_000);
  const pick = (h + day) % 5;
  const codes = [0, 2, 61, 3, 45];
  const sky = skyFromWmo(codes[pick]);
  return { city, tempC: 14 + ((h >> 3) % 16), ...sky, source: "mock", at: now.toISOString() };
}

const CACHE = new Map<string, { at: number; w: Weather }>();
const TTL = 30 * 60_000;

/** Server only. Geocode the city name, read current weather, cache 30 min. */
export async function fetchWeather(city: string, fetcher: typeof fetch = fetch): Promise<Weather | null> {
  const key = city.trim().toLowerCase();
  const hit = CACHE.get(key);
  if (hit && Date.now() - hit.at < TTL) return hit.w;
  try {
    const geo = await fetcher(`https://geocoding-api.open-meteo.com/v1/search?count=1&language=en&format=json&name=${encodeURIComponent(city)}`, { signal: AbortSignal.timeout(4000) });
    if (!geo.ok) return null;
    const g = (await geo.json()) as { results?: { latitude: number; longitude: number }[] };
    const place = g.results?.[0];
    if (!place) return null;
    const res = await fetcher(`https://api.open-meteo.com/v1/forecast?latitude=${place.latitude}&longitude=${place.longitude}&current=temperature_2m,weather_code`, { signal: AbortSignal.timeout(4000) });
    if (!res.ok) return null;
    const d = (await res.json()) as { current?: { temperature_2m?: number; weather_code?: number } };
    if (typeof d.current?.temperature_2m !== "number" || typeof d.current.weather_code !== "number") return null;
    const w: Weather = { city, tempC: Math.round(d.current.temperature_2m), ...skyFromWmo(d.current.weather_code), source: "open-meteo", at: new Date().toISOString() };
    CACHE.set(key, { at: Date.now(), w });
    return w;
  } catch {
    return null;
  }
}
