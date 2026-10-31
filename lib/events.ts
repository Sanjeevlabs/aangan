// Family events (Gathering): the plan Muse drafts for an occasion, the
// three time slots that work across every home, one-tap availability, and
// the lock rule. Pure and client-safe: no fs, no fetch. Event specifics (run
// of show, tasks, songs) are data in data/event-templates.json.
import { z } from "zod";
import TEMPLATES from "@/data/event-templates.json";
import { hourIn } from "./zones";

export const EVENT_TYPES = ["birthday", "festival", "anniversary", "visit", "custom"] as const;
export type EventType = (typeof EVENT_TYPES)[number];
export const OWNER_HINTS = ["honoree", "elder", "host", "adult", "child", "everyone"] as const;
export type OwnerHint = (typeof OWNER_HINTS)[number];

/** Awake hours for proposing a call: 8 AM to 10 PM in each person's own zone. */
export const AWAKE_FROM = 8;
export const AWAKE_TO = 22;
const SLOT = 30 * 60_000;
const HOUR = 3_600_000;

const id = z.string().min(1).max(64);
const iso = z.string().datetime();

export const RunStepSchema = z.object({
  id,
  title: z.string().trim().min(2).max(60),
  minutes: z.number().int().min(1).max(30),
  /** Member id, or null for "everyone". */
  ownerId: z.string().max(64).nullable().default(null),
  note: z.string().trim().max(120).default(""),
});

export const TaskSchema = z.object({
  id,
  text: z.string().trim().min(2).max(80),
  ownerId: z.string().max(64).nullable().default(null),
  done: z.boolean().default(false),
});

/** Placeholder artists a model uses when it cannot really name one. */
const NOT_AN_ARTIST = /^(unknown|various( artists)?|traditional|anonymous|n\/?a|tbd|none|-+)$/i;

export const SongSchema = z.object({
  title: z.string().trim().min(1).max(80),
  artist: z
    .string()
    .trim()
    .min(2)
    .max(80)
    .refine((a) => !NOT_AN_ARTIST.test(a), "a song needs a real artist"),
  why: z.string().trim().min(2).max(100),
});

export const EventPlanSchema = z.object({
  runOfShow: z.array(RunStepSchema).min(3).max(8),
  tasks: z.array(TaskSchema).min(1).max(10),
  playlist: z.array(SongSchema).min(5).max(8),
});

export const SlotSchema = z.object({ id, startsAt: iso });

export const EventSchema = z.object({
  id,
  type: z.enum(EVENT_TYPES),
  title: z.string().trim().min(2).max(80),
  /** Whose day it is (a birthday, the one coming home); null for everyone. */
  forMemberId: z.string().max(64).nullable().default(null),
  /** The occasion it came from: "birthday" or a holiday key; null for custom. */
  occasionKey: z.string().max(60).nullable().default(null),
  /** YYYY-MM-DD: roughly when. */
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  hostId: id,
  invites: z.array(id).max(40).default([]),
  minutes: z.number().int().min(15).max(90).default(45),
  slots: z.array(SlotSchema).max(3).default([]),
  /** slotId -> member ids who can make it. */
  votes: z.record(z.string(), z.array(id)).default({}),
  /** Who has answered at all (so "none of these" counts as an answer). */
  answered: z.array(id).default([]),
  status: z.enum(["voting", "locked", "cancelled"]).default("voting"),
  lockedSlotId: z.string().nullable().default(null),
  /** The gathering session (a sitting with its Jitsi room) once locked. */
  sittingId: z.string().nullable().default(null),
  plan: EventPlanSchema,
  planSource: z.enum(["muse", "fallback"]).default("fallback"),
  /** An owner or admin asked Muse to plan a cake, flowers or sweets too. Off by default. */
  extras: z.boolean().default(false),
  createdAt: iso,
});

export type RunStep = z.infer<typeof RunStepSchema>;
export type EventTask = z.infer<typeof TaskSchema>;
export type Song = z.infer<typeof SongSchema>;
export type EventPlan = z.infer<typeof EventPlanSchema>;
export type FamilyEvent = z.infer<typeof EventSchema>;
export type Slot = z.infer<typeof SlotSchema>;

/* -------------------------------------------------------------- templates */
interface TemplateStep { title: string; minutes: number; owner: string; note: string }
interface TemplateTask { text: string; owner: string }
export interface EventTemplate {
  label: string;
  titleFor: string;
  sittingReason: string;
  minutes: number;
  runOfShow: TemplateStep[];
  tasks: TemplateTask[];
  /** Things to buy or arrange (a cake, flowers, sweets): only when an owner or admin asks. */
  extras?: { step?: TemplateStep; tasks: TemplateTask[] };
}

/**
 * Words that mean buying, ordering or bringing something. A plan without
 * extras must contain none of them (Muse drafts that do fall back to the template).
 */
export const PURCHASE_WORDS = /\b(cakes?|candles?|gifts?|presents?|flowers?|bouquets?|sweets|mithai|order(s|ing)?|buy(ing)?|purchase|shop(s|ping)?|deliver(y|ed)?|bring(s|ing)?|cater(ing)?)\b/i;

export function planMentionsPurchase(plan: EventPlan): boolean {
  return [...plan.runOfShow.flatMap((s) => [s.title, s.note]), ...plan.tasks.map((t) => t.text)].some((x) => PURCHASE_WORDS.test(x));
}
const T = TEMPLATES as unknown as {
  types: Record<EventType, EventTemplate>;
  byOccasion: Record<string, { type: EventType }>;
  playlists: Record<EventType, Record<string, Song[]>>;
};

export function templateFor(type: EventType): EventTemplate {
  return T.types[type] ?? T.types.custom;
}

export function eventTypeLabel(type: EventType): string {
  return templateFor(type).label;
}

/** Which event type an occasion becomes: data first, then its kind. */
export function typeForOccasion(slug: string | null, kind?: "birthday" | "festival" | "national"): EventType {
  if (slug && T.byOccasion[slug]) return T.byOccasion[slug].type;
  if (kind === "birthday") return "birthday";
  if (kind === "festival" || kind === "national") return "festival";
  return "custom";
}

export function eventTitle(type: EventType, name: string): string {
  return templateFor(type).titleFor.replace("{name}", name.trim() || "Family");
}

interface Person { id: string; role: string; lang?: string; access?: string }

/** Resolve an owner hint to a real member. Spreads tasks among grown-ups. */
export function resolveOwner(hint: string, people: Person[], ctx: { hostId: string; honoreeId: string | null }, turn = 0): string | null {
  const others = people.filter((p) => p.id !== ctx.honoreeId);
  const pick = (list: Person[]) => (list.length ? list[turn % list.length].id : null);
  switch (hint) {
    case "host":
      return ctx.hostId;
    case "honoree":
      return ctx.honoreeId ?? ctx.hostId;
    case "elder":
      return pick(others.filter((p) => p.role === "elder")) ?? pick(people.filter((p) => p.role === "elder"));
    case "adult":
      return pick(others.filter((p) => p.role === "adult")) ?? ctx.hostId;
    case "child":
      return pick(others.filter((p) => p.role === "child")) ?? pick(others.filter((p) => p.role === "adult")) ?? ctx.hostId;
    default:
      return null;
  }
}

/** The family's languages, most common first ("hi", "en"). */
export function familyLangs(people: Person[]): string[] {
  const n = new Map<string, number>();
  for (const p of people) {
    const l = (p.lang ?? "en").split("-")[0].toLowerCase();
    n.set(l, (n.get(l) ?? 0) + 1);
  }
  return Array.from(n.entries()).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([l]) => l);
}

/** The bundled playlist: songs in the family's own languages, then English. 5–8 songs. */
export function fallbackPlaylist(type: EventType, langs: string[]): Song[] {
  const lists = T.playlists[type] ?? T.playlists.custom;
  const order = Array.from(new Set([...langs, "en", ...Object.keys(lists)]));
  const per = order.map((l) => [...(lists[l] ?? [])]);
  const out: Song[] = [];
  // Interleave languages so every generation hears something of theirs.
  while (out.length < 8 && per.some((p) => p.length)) {
    for (const p of per) {
      const s = p.shift();
      if (s && !out.some((x) => x.title === s.title)) out.push(s);
      if (out.length >= 8) break;
    }
  }
  return out.slice(0, 8);
}

/** The deterministic plan for an event type: data from data/event-templates.json. */
export function fallbackPlan(type: EventType, people: Person[], ctx: { hostId: string; honoreeId: string | null }, opts: { extras?: boolean } = {}): EventPlan {
  const tpl = templateFor(type);
  let adultTurn = 0;
  const extra = opts.extras ? tpl.extras : undefined;
  // The extras step (cake and candles) takes the place of the moment step, same minutes.
  const steps = extra?.step ? tpl.runOfShow.map((s) => (s.minutes === extra.step!.minutes && /song|sing|moment/i.test(s.title) ? extra.step! : s)) : tpl.runOfShow;
  const tasks = [...tpl.tasks.slice(0, -1), ...(extra?.tasks ?? []), ...tpl.tasks.slice(-1)];
  return {
    runOfShow: steps.map((s, i) => ({ id: `r${i + 1}`, title: s.title, minutes: s.minutes, ownerId: resolveOwner(s.owner, people, ctx), note: s.note })),
    tasks: tasks.map((t, i) => ({ id: `t${i + 1}`, text: t.text, ownerId: resolveOwner(t.owner, people, ctx, t.owner === "adult" ? adultTurn++ : 0), done: false })),
    playlist: fallbackPlaylist(type, familyLangs(people)),
  };
}

/* ------------------------------------------------------------ music links */
/** Search links only: we never host or stream audio. */
export function songLinks(song: Pick<Song, "title" | "artist">): { youtube: string; spotify: string } {
  const q = `${song.title} ${song.artist}`.trim();
  return {
    youtube: `https://music.youtube.com/search?q=${encodeURIComponent(q)}`,
    spotify: `https://open.spotify.com/search/${encodeURIComponent(q)}`,
  };
}

/* ------------------------------------------------------------------ slots */
function localDate(tz: string, at: Date): string {
  try {
    return new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit", timeZone: tz }).format(at);
  } catch {
    return at.toISOString().slice(0, 10);
  }
}

/** Is every zone awake (8 AM–10 PM) for the whole call? */
export function fitsEveryone(zones: string[], start: Date, minutes: number): boolean {
  const end = new Date(start.getTime() + minutes * 60_000 - 1);
  return zones.every((z) => {
    const a = hourIn(z, start);
    const b = hourIn(z, end);
    return a >= AWAKE_FROM && b < AWAKE_TO && b >= a;
  });
}

/**
 * Three start times around `date` (YYYY-MM-DD in the host's zone) when every
 * home is awake for the whole call. Prefers the day itself, then the evening
 * before/after; prefers early evening for the host; keeps slots 2h+ apart.
 * Never in the past (at least an hour from now).
 */
export function proposeSlots(input: { zones: string[]; hostTz: string; date: string; minutes?: number; now?: Date; n?: number }): Date[] {
  const minutes = input.minutes ?? 45;
  const now = input.now ?? new Date();
  const n = input.n ?? 3;
  const zones = Array.from(new Set([input.hostTz, ...input.zones].filter((z) => z && z !== "UTC")));
  if (zones.length === 0) zones.push("UTC");
  const day = Date.parse(`${input.date}T12:00:00Z`);
  if (!Number.isFinite(day)) return [];
  const soonest = now.getTime() + HOUR;
  const cands: { t: number; score: number }[] = [];
  for (let t = Math.ceil((day - 3 * 24 * HOUR) / SLOT) * SLOT; t <= day + 3 * 24 * HOUR; t += SLOT) {
    if (t < soonest) continue;
    const d = new Date(t);
    if (!fitsEveryone(zones, d, minutes)) continue;
    const local = localDate(input.hostTz, d);
    const off = Math.abs(Math.round((Date.parse(`${local}T12:00:00Z`) - day) / (24 * HOUR)));
    const h = hourIn(input.hostTz, d);
    // The day itself first; on any day, near 7 PM for the host; weekend-ish mornings are fine too.
    const score = off * 10 + Math.min(Math.abs(h - 19), Math.abs(h - 11) + 1.5);
    cands.push({ t, score });
  }
  cands.sort((a, b) => a.score - b.score || a.t - b.t);
  const picks: number[] = [];
  for (const c of cands) {
    if (picks.every((p) => Math.abs(p - c.t) >= 2 * HOUR)) picks.push(c.t);
    if (picks.length >= n) break;
  }
  return picks.sort((a, b) => a - b).map((t) => new Date(t));
}

/* ---------------------------------------------------------------- voting */
export function participants(e: Pick<FamilyEvent, "hostId" | "invites">): string[] {
  return Array.from(new Set([e.hostId, ...e.invites]));
}

/** One tap: toggle "I can make this slot". Answering marks you as answered. */
export function toggleVote(e: FamilyEvent, slotId: string, memberId: string): FamilyEvent {
  if (!e.slots.some((s) => s.id === slotId)) return e;
  const cur = e.votes[slotId] ?? [];
  const next = cur.includes(memberId) ? cur.filter((x) => x !== memberId) : [...cur, memberId];
  return { ...e, votes: { ...e.votes, [slotId]: next }, answered: Array.from(new Set([...e.answered, memberId])) };
}

/** "None of these work for me": counted as an answer, no slot. */
export function markNone(e: FamilyEvent, memberId: string): FamilyEvent {
  const votes: Record<string, string[]> = {};
  for (const [k, v] of Object.entries(e.votes)) votes[k] = v.filter((x) => x !== memberId);
  return { ...e, votes, answered: Array.from(new Set([...e.answered, memberId])) };
}

/** The slot most people can make (ties: earliest). */
export function bestSlot(e: FamilyEvent): { slot: Slot; count: number } | null {
  let best: { slot: Slot; count: number } | null = null;
  for (const s of [...e.slots].sort((a, b) => a.startsAt.localeCompare(b.startsAt))) {
    const count = (e.votes[s.id] ?? []).length;
    if (!best || count > best.count) best = { slot: s, count };
  }
  return best;
}

/**
 * Lock when most can make it: a slot more than half of everyone can make.
 * Returns the slot to lock, or null to keep waiting.
 */
export function slotToLock(e: FamilyEvent): Slot | null {
  if (e.status !== "voting") return null;
  const total = participants(e).length;
  const best = bestSlot(e);
  if (!best || best.count === 0) return null;
  return best.count * 2 > total ? best.slot : null;
}

/* --------------------------------------------------------------- display */
export function lockedStart(e: FamilyEvent): Date | null {
  const s = e.slots.find((x) => x.id === e.lockedSlotId);
  return s ? new Date(s.startsAt) : null;
}

/** Live from 15 minutes before until the call's end (+30 min grace). */
export function isLive(e: FamilyEvent, now = new Date()): boolean {
  const start = lockedStart(e);
  if (!start || e.status !== "locked") return false;
  const mins = (start.getTime() - now.getTime()) / 60_000;
  return mins <= 15 && mins > -(e.minutes + 30);
}

export function fmtIn(tz: string, d: Date | string, opts: Intl.DateTimeFormatOptions): string {
  try {
    return new Intl.DateTimeFormat("en-US", { ...opts, timeZone: tz }).format(typeof d === "string" ? new Date(d) : d);
  } catch {
    return "";
  }
}

/** "Starts in 1 hour", "Starts in 20 min", "Live now". */
export function startsInLabel(start: Date, now = new Date()): string {
  const mins = Math.round((start.getTime() - now.getTime()) / 60_000);
  if (mins <= 0) return "Live now";
  if (mins < 55) return `Starts in ${mins} min`;
  if (mins <= 90) return "Starts in 1 hour";
  const h = Math.round(mins / 60);
  if (h < 24) return `Starts in ${h} hours`;
  const d = Math.round(h / 24);
  return d === 1 ? "Tomorrow" : `In ${d} days`;
}

/** Stable key for an occasion on a date (one event per occasion per date). */
export function occasionEventKey(occasionKey: string | null, date: string, forMemberId: string | null): string {
  return `${occasionKey ?? "custom"}:${forMemberId ?? "all"}:${date}`;
}
