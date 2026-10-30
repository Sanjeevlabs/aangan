// Muse drafts an event plan: run of show, tasks with owners, and a playlist
// grounded in the family's languages. Zod-validated (lib/muse.ts: one retry,
// then the deterministic plan from data/event-templates.json). Server only.
import { describeLang } from "./languages";
import { museJson } from "./muse";
import { EventPlanSchema, fallbackPlan, familyLangs, templateFor, type EventPlan, type EventType } from "./events";
import type { Member } from "./schemas";

const SYSTEM =
  "You plan a 30 to 60 minute family video get-together for a family living in different homes. " +
  "Reply with JSON only: {runOfShow:[{id,title,minutes,ownerId,note}], tasks:[{id,text,ownerId,done:false}], playlist:[{title,artist,why}]}. " +
  "runOfShow: 4 to 6 short steps, in this order where they fit: a welcome, the Chorus of wishes (everyone wishes in turn), a story from an elder, " +
  "a shared moment (cake and candles, or lighting a lamp together), open chat. Minutes add up to the call length. Titles under 6 words; notes one short line. " +
  "tasks: 3 to 6 practical jobs (who calls the cake shop, who collects old photos, who plays the song, who sends the link). " +
  "ownerId must be one of the member ids given, or null for everyone. Never give the person being celebrated a job that spoils a surprise. " +
  "playlist: 5 to 8 real, well-known songs that fit the occasion, mixing the family's languages so every generation hears something of theirs. " +
  "Only list a song you can name with its real performing artist; if you are not sure a song exists, leave it out. No medical, legal or financial advice.";

export async function draftPlan(input: {
  familyId: string;
  type: EventType;
  title: string;
  hostId: string;
  honoreeId: string | null;
  minutes: number;
  members: Member[];
  occasionNote?: string;
}): Promise<{ plan: EventPlan; source: "muse" | "fallback" }> {
  const people = input.members.map((m) => ({ id: m.id, role: m.role, lang: m.lang, access: m.access }));
  const ctx = { hostId: input.hostId, honoreeId: input.honoreeId };
  const fallback = fallbackPlan(input.type, people, ctx);
  const ids = new Set(input.members.map((m) => m.id));
  const langs = familyLangs(people);
  const tpl = templateFor(input.type);
  const user = [
    `Event: ${input.title} (${tpl.label}). Call length: ${input.minutes} minutes.`,
    input.honoreeId ? `Celebrating: ${input.honoreeId}.` : "Celebrating: the whole family.",
    input.occasionNote ? `About the occasion: ${input.occasionNote.slice(0, 300)}` : "",
    `Host: ${input.hostId}.`,
    `Family languages: ${langs.map((l) => describeLang(l)).join("; ")}.`,
    "Members (id, name, role, language):",
    ...input.members.map((m) => `- ${m.id}, ${m.displayName || m.firstName}, ${m.role}, ${m.lang}`),
  ]
    .filter(Boolean)
    .join("\n");
  const out = await museJson<EventPlan>({
    familyId: input.familyId,
    purpose: `Drafted the plan for ${input.title}`,
    system: SYSTEM,
    user,
    schema: EventPlanSchema,
    mock: () => fallback,
    fallback,
    maxTokens: 1600,
    // Grounding: owners are real members; no song without an artist (schema); unique songs.
    accept: (p) =>
      [...p.runOfShow, ...p.tasks].every((x) => x.ownerId === null || ids.has(x.ownerId)) &&
      new Set(p.playlist.map((s) => `${s.title}|${s.artist}`.toLowerCase())).size === p.playlist.length,
  });
  // Normalise ids so task edits are stable whatever the model wrote.
  const plan: EventPlan = {
    runOfShow: out.data.runOfShow.map((s, i) => ({ ...s, id: `r${i + 1}` })),
    tasks: out.data.tasks.map((t, i) => ({ ...t, id: `t${i + 1}`, done: false })),
    playlist: out.data.playlist,
  };
  return { plan, source: out.source };
}
