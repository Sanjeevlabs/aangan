// Server side of the window: who's on the other side, their sky, and the
// motion Muse composes over the chosen photo. Server only.
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
import { withDemoShelf } from "./demo";

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
}

const DEFAULT_IMAGE = { elders: "/demo/courtyard.jpg", children: "/demo/home-city.svg" };

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
  const home = viewer ? farHomeFor(viewer, members, relationships) : undefined;
  const city = cityOf(home);
  const tz = home?.tz ?? viewer?.tz ?? "UTC";
  const phase = phaseFor(hourIn(tz, now));
  const weather = await weatherFor(city);
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
  };
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
