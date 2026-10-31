// Server side of the window: who's on the other side, their sky, and the
// motion Muse composes over the chosen photo. Server only.
import { can } from "./permissions";
import { z } from "zod";
import { dbListCards, dbListMembers, dbListRelationships } from "./db";
import { getDoc, listDocs } from "./family-docs";
import { WINDOW_LAYERS, type Presence, type WindowLayer, type WindowView } from "./kinds";
import { museJson } from "./muse";
import { MOMENT_LABEL, todayFor } from "./presence";
import type { Member } from "./schemas";
import { fetchWeather, mockWeather, phaseFor, type DayPhase, type Weather } from "./weather";
import { cityOf, farHomeFor, groundedLayers, plainLine } from "./window";
import { hourIn } from "./zones";
import { aliveState, type Alive } from "./status";
import { dayRhythm, rhythmLine, type DayRhythm } from "./rhythm";
import { moonPhase, sunInArch, sunPosition } from "./sky";
import type { FirstScene, Pot, Wall } from "./kinds";
import { withDemoShelf } from "./demo";
import { isDemoFamily } from "./auth";
import { createDownloadUrl } from "./storage";

export interface WindowState {
  view: WindowView | null;
  imageRef: string;
  far: { ids: string[]; names: string; city: string; tz: string } | null;
  weather: Weather | null;
  phase: DayPhase;
  layers: WindowLayer[];
  line: string;
  /** What they shared today, newest first, in words ("is having chai"). */
  moments: { memberId: string; label: string; at: string }[];
  /** Safe & sound at a glance, per person at the window (at most two). */
  people: { id: string; lastActive: string | null; state: Alive; line: string; rhythm: DayRhythm }[];
  /** This viewer's amber threshold, in hours. */
  quietAfterHours: number;
  /** A family photo was chosen for this window (else: the scene slideshow). */
  chosen: boolean;
  /** Someone on the other side has signed in (has an account). Emails never leave the server. */
  joined: boolean;
  /** How far apart the two homes are, in km (city to city), when both are known. */
  km: number | null;
  /** The wall around this viewer's window. */
  wall: Wall;
  /** Their real sky: the sun in the arch (null when it has set) and tonight's moon. */
  sky: { sun: { x: number; y: number } | null; moon: { illumination: number; waxing: boolean; name: string } };
  /** Is now a good time to call, in their day and yours. */
  call: { good: boolean; text: string };
  /** What this viewer stands at: window, balcony or courtyard. */
  scene: FirstScene;
  /** Flower pots on the sill / railing / courtyard floor (up to three). */
  pots: Pot[];
  /** A photo of their actual home as the view (a media ref), else null: the living album. */
  homePhoto: string | null;
  /** With a home photo: family photos cross-fade in now and then. */
  mixAlbum: boolean;
}

/**
 * A viewer's window before they've changed anything. Real families: the
 * window, no pots, the living album. The synthetic demo families open on
 * marigold and jasmine on the sill, so the demo shows something lovely.
 */
export function defaultView(familyId: string, memberId: string): WindowView {
  return {
    id: memberId,
    memberId,
    cardId: null,
    imageRef: null,
    style: "living",
    layers: [],
    line: "",
    madeBy: "family",
    quietAfterHours: 4,
    people: [],
    wall: "jodhpur",
    scene: "window",
    pots: isDemoFamily(familyId) ? ["marigold", "jasmine"] : [],
    homePhoto: null,
    mixAlbum: true,
    updatedAt: new Date(0).toISOString(),
  };
}

const STORAGE_PATH = /^[A-Za-z0-9._-]+(\/[A-Za-z0-9._-]+)+$/;

/**
 * Is this media ref the family's own photo? Either a file this family
 * uploaded to its private storage (and that exists), or the photo of one of
 * its own photo cards. Never another family's path, never another host.
 */
export async function homePhotoOk(familyId: string, ref: string): Promise<boolean> {
  if (ref.startsWith("storage:")) {
    const path = ref.slice("storage:".length);
    if (!path.startsWith(`${familyId}/`) || path.includes("..") || !STORAGE_PATH.test(path)) return false;
    return (await createDownloadUrl(path)) !== null;
  }
  const cards = withDemoShelf(await dbListCards(familyId), familyId);
  return cards.some((c) => c.type === "photo" && c.mediaRef === ref);
}

const DEFAULT_IMAGE = { elders: "/demo/aangan-home.svg", children: "/demo/home-city.svg" };

async function weatherFor(city: string): Promise<Weather | null> {
  if (!city) return null;
  return process.env.MOCK === "true" ? mockWeather(city) : await fetchWeather(city);
}

function names(ms: Member[]): string {
  const call = (m: Member) => m.displayName || m.firstName;
  const list = ms.filter((m) => m.role !== "child").map(call);
  return list.length <= 1 ? (list[0] ?? "") : `${list.slice(0, -1).join(", ")} & ${list[list.length - 1]}`;
}

export async function windowState(familyId: string, viewerId: string, now = new Date()): Promise<WindowState> {
  const [members, relationships, view] = await Promise.all([dbListMembers(familyId), dbListRelationships(familyId), getDoc(familyId, "window_view", viewerId)]);
  const viewer = members.find((m) => m.id === viewerId);
  const farHome = viewer ? farHomeFor(viewer, members, relationships) : undefined;
  // Who's at your window: your choice (at most two), else the grown-ups on the other side.
  // Teens are never at a window, even if picked before they became one.
  const chosen = (view?.people ?? []).map((id) => members.find((m) => m.id === id && m.id !== viewerId)).filter((m): m is Member => Boolean(m) && can(m, "window.at")).slice(0, 2);
  const home = chosen.length ? { id: `chosen-${chosen.map((m) => m.id).join("-")}`, members: chosen, tz: chosen[0].tz, elders: chosen.some((m) => m.role === "elder") } : farHome;
  const city = cityOf(home);
  const tz = home?.tz ?? viewer?.tz ?? "UTC";
  const phase = phaseFor(hourIn(tz, now));
  const [weather, here] = await Promise.all([weatherFor(city), weatherFor(viewer?.city ?? "")]);
  const presence = await listDocs(familyId, "presence");
  const ids = home?.members.map((m) => m.id) ?? [];
  const today: Presence[] = ids.flatMap((id) => todayFor(id, presence, tz, now)).filter((p) => p.moment !== "here");
  today.sort((a, b) => b.at.localeCompare(a.at));
  const grounded = groundedLayers(weather, phase, today.map((p) => p.moment).reverse());
  // Muse's choice stands only while it's fresh and only inside what's grounded.
  const fresh = view && view.madeBy === "muse" && now.getTime() - Date.parse(view.updatedAt) < 3 * 3_600_000;
  const layers = view?.style === "still" ? [] : fresh ? view.layers.filter((l) => grounded.includes(l)) : grounded;
  const who = names(home?.members ?? []);
  const latest = today[0] ? `${members.find((m) => m.id === today[0].memberId)?.displayName ?? ""} ${MOMENT_LABEL[today[0].moment].line}`.trim() : null;
  const line = fresh && view.line ? view.line : plainLine(who, city, weather, latest);
  // Last sign of life in Aangan: any moment (opening the app included), a
  // voice or photo they sent, a safety check-in. Only what they already share.
  const [cards, checkins, settings] = await Promise.all([dbListCards(familyId), listDocs(familyId, "safety_checkin"), listDocs(familyId, "care_settings")]);
  const signs = (id: string): string[] =>
    [
      ...presence.filter((p) => p.memberId === id).map((p) => p.at),
      ...withDemoShelf(cards, familyId).filter((c) => c.authorId === id && Date.parse(c.takenAt) <= now.getTime()).map((c) => c.takenAt),
      ...checkins.filter((c) => c.memberId === id).map((c) => c.closedAt ?? c.at),
    ].filter((t) => Date.parse(t) <= now.getTime());
  const lastSeen = (id: string): string | null => signs(id).sort().pop() ?? null;
  const people = (home?.members ?? [])
    .filter((m) => m.role !== "child")
    .map((m) => {
      const shares = settings.find((s) => s.memberId === m.id)?.shareVisits ?? true;
      const lastActive = shares ? lastSeen(m.id) : null;
      const state = aliveState(lastActive, m.tz, { shares, now, quietAfter: view?.quietAfterHours });
      const rhythm = dayRhythm(shares ? signs(m.id) : [], m.tz, now);
      return { id: m.id, lastActive, state, rhythm, line: rhythmLine(state, lastActive, rhythm, m.tz, (iso) => agoWords(iso, now)) };
    })
    .slice(0, 2);
  const own = view ?? defaultView(familyId, viewerId);
  let imageRef = view?.imageRef ?? null;
  if (!imageRef) imageRef = home?.elders ? DEFAULT_IMAGE.elders : DEFAULT_IMAGE.children;
  return {
    view: view ?? null,
    imageRef,
    far: home ? { ids, names: who, city, tz } : null,
    weather,
    phase,
    layers,
    line,
    moments: today.slice(0, 4).map((p) => ({ memberId: p.memberId, label: MOMENT_LABEL[p.moment].line, at: p.at })),
    people,
    quietAfterHours: view?.quietAfterHours ?? 4,
    chosen: Boolean(view?.cardId && view.imageRef),
    // Signed in, or has done anything in Aangan (the demo family has no emails).
    km: distanceKm(weather, here),
    wall: view?.wall ?? "jodhpur",
    sky: skyOver(weather, now),
    call: callHint(tz, viewer?.tz ?? tz, home?.members.filter((m) => m.role !== "child").map((m) => m.displayName || m.firstName) ?? [], now),
    joined: (home?.members ?? []).some((m) => m.role !== "child" && (Boolean(m.email) || lastSeen(m.id) !== null)),
    scene: own.scene,
    pots: own.pots,
    homePhoto: own.homePhoto,
    mixAlbum: own.mixAlbum,
  };
}

function distanceKm(a: Weather | null, b: Weather | null): number | null {
  if (a?.lat === undefined || a.lon === undefined || b?.lat === undefined || b.lon === undefined) return null;
  const R = 6371;
  const r = Math.PI / 180;
  const dLat = (b.lat - a.lat) * r;
  const dLon = (b.lon - a.lon) * r;
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLon / 2) ** 2;
  const km = 2 * R * Math.asin(Math.sqrt(x));
  return km < 15 ? null : Math.round(km / 10) * 10;
}

function agoWords(iso: string, now: Date): string {
  const min = Math.max(0, Math.round((now.getTime() - Date.parse(iso)) / 60_000));
  if (min < 2) return "just now";
  if (min < 60) return `${min} min ago`;
  const h = Math.round(min / 60);
  return h < 24 ? `${h} h ago` : `${Math.round(h / 24)} d ago`;
}

function skyOver(weather: Weather | null, now: Date): WindowState["sky"] {
  const m = moonPhase(now);
  const sun = weather?.lat !== undefined && weather.lon !== undefined ? sunInArch(sunPosition(weather.lat, weather.lon, now)) : null;
  return { sun, moon: { illumination: Math.round(m.illumination * 100) / 100, waxing: m.waxing, name: m.name } };
}

function clockIn(tz: string, d: Date): string {
  try {
    return new Intl.DateTimeFormat("en-US", { timeZone: tz, hour: "numeric", minute: "2-digit" }).format(d);
  } catch {
    return "";
  }
}

/** Both awake and not in the dead of night on either side: say so. Otherwise, when. */
export function callHint(theirTz: string, myTz: string, names: string[], now = new Date()): { good: boolean; text: string } {
  const them = hourIn(theirTz, now);
  const me = hourIn(myTz, now);
  const who = names.length <= 1 ? (names[0] ?? "them") : `${names.slice(0, -1).join(", ")} & ${names[names.length - 1]}`;
  if (them >= 8 && them < 21.5 && me >= 7 && me < 23) return { good: true, text: `Good time to call ${who}` };
  if (them < 8 || them >= 21.5) {
    // Next 8 AM there, in your time.
    const wait = ((8 - them + 24) % 24) * 3_600_000;
    return { good: false, text: `They're asleep · best from 8 AM their time (${clockIn(myTz, new Date(now.getTime() + wait))} yours)` };
  }
  return { good: false, text: `It's late for you · ${clockIn(theirTz, now)} there` };
}

/** A photo card from this family, as the window's image. */
export async function photoRefFor(familyId: string, cardId: string): Promise<string | null> {
  const card = withDemoShelf(await dbListCards(familyId), familyId).find((c) => c.id === cardId);
  if (!card || card.type !== "photo") return null;
  return card.mediaRef;
}

const SceneSchema = z.object({
  layers: z.array(z.enum(WINDOW_LAYERS)).max(4),
  line: z.string().min(3).max(140),
});

/**
 * Muse composes the window: which of the grounded motions to show and one
 * quiet line from what is actually true there. Validated, grounded, cached.
 */
export async function composeWindow(familyId: string, state: WindowState, caption: string): Promise<{ layers: WindowLayer[]; line: string; source: "muse" | "fallback" }> {
  const grounded = state.layers.length ? state.layers : groundedLayers(state.weather, state.phase, []);
  const facts = [
    `Home: ${state.far?.names ?? "family"} in ${state.far?.city || "their town"}`,
    `Time of day there: ${state.phase}`,
    state.weather ? `Weather there: ${state.weather.label}, ${state.weather.tempC}°C` : "Weather: unknown",
    `Shared today: ${state.moments.map((m) => m.label).join("; ") || "nothing yet"}`,
    `Photo in the window: ${caption || "their home"}`,
    `Allowed motion layers (choose from these only): ${grounded.join(", ") || "none"}`,
  ].join("\n");
  const fallback = { layers: grounded, line: state.line };
  const out = await museJson({
    familyId,
    purpose: `Brought the window to ${state.far?.names ?? "the other home"} to life`,
    system:
      "You compose a calm 'window' onto a family member's home far away. Reply with JSON {layers, line}. " +
      "layers: up to 4, ONLY from the allowed list, most fitting first. line: one warm sentence (max 120 chars) " +
      "using ONLY the facts given: who, the time of day, the weather, what they shared. Never invent events, health, or feelings.",
    user: facts,
    schema: SceneSchema,
    mock: () => ({ layers: grounded, line: state.line }),
    fallback,
    maxTokens: 300,
    accept: (d) => d.layers.every((l) => grounded.includes(l)),
  });
  return { ...out.data, source: out.source };
}
