import { z } from "zod";
import { HELPER_ROLES, NEED_KINDS, PRESENCE_MOMENTS, SITTING_REASONS } from "./kind-values";

export { HELPER_ROLES, NEED_KINDS, PRESENCE_MOMENTS, SITTING_REASONS };

// Schemas for the family's "living" records: Kitchen, presence, care,
// Village, sittings and the weekly question. They share one table
// (family_docs, jsonb) and are validated here on every read and write, so a
// new room costs a schema, not a migration. Clients import types only.

const iso = z.string().datetime();
const id = z.string().min(1).max(80);

// ---------- Kitchen ----------
export const IngredientSchema = z.object({
  item: z.string().min(1).max(80),
  /** Exactly as the cook said it: "a fistful", "two small katoris". */
  said: z.string().max(80).default(""),
  /** A cautious everyday equivalent for someone abroad: "≈ ½ cup". Never invented precision. */
  approx: z.string().max(40).default(""),
});

export const StepSchema = z.object({
  text: z.string().min(1).max(400),
  /** The cook's own warning or secret, kept in their voice. */
  tip: z.string().max(200).default(""),
});

export const RecipeSchema = z.object({
  id,
  title: z.string().min(1).max(80),
  /** The family member whose recipe this is. */
  cookId: id,
  /** The voice note it was taught in (a card), if any. */
  voiceCardId: z.string().nullable().default(null),
  coverRef: z.string().nullable().default(null),
  /** One line of why it matters: "Every Sunday in Kanpur, after the market." */
  memory: z.string().max(240).default(""),
  serves: z.string().max(40).default(""),
  ingredients: z.array(IngredientSchema).max(40).default([]),
  steps: z.array(StepSchema).max(30).default([]),
  lang: z.string().default("en"),
  /** Who structured it: the cook by hand, or Muse from the voice note. */
  madeBy: z.enum(["family", "muse"]).default("family"),
  createdAt: iso,
});

export const AttemptSchema = z.object({
  id,
  recipeId: id,
  memberId: id,
  photoRef: z.string().nullable().default(null),
  note: z.string().max(240).default(""),
  /** Family members who blessed this attempt (the cook's blessing matters most). */
  blessedBy: z.array(id).default([]),
  createdAt: iso,
});

// ---------- Presence (a parent's day, felt from far away) ----------
export const PresenceMomentSchema = z.enum(PRESENCE_MOMENTS);

export const PresenceSchema = z.object({
  id,
  memberId: id,
  moment: PresenceMomentSchema,
  note: z.string().max(120).default(""),
  at: iso,
});

/** Opt-in, owned by the parent: who is told, and only when the day is unusually quiet. */
export const CareSettingsSchema = z.object({
  id, // = memberId of the parent
  memberId: id,
  quietAlert: z.boolean().default(false),
  /** The one family member the parent chose to be told. */
  tellMemberId: z.string().nullable().default(null),
  /** Hours past their usual first moment before a gentle note (default 3). */
  graceHours: z.number().int().min(1).max(12).default(3),
  /** Opening the app counts as "in the courtyard" for the family. */
  shareVisits: z.boolean().default(true),
  updatedAt: iso,
});

// ---------- Care circle ----------
export const NeedSchema = z.object({
  id,
  /** Whose need (usually a parent). */
  forMemberId: id,
  askedBy: id,
  title: z.string().min(1).max(120),
  kind: z.enum(NEED_KINDS).default("other"),
  when: z.string().max(60).default(""),
  status: z.enum(["open", "claimed", "done"]).default("open"),
  /** The family member taking responsibility (often abroad). */
  claimedBy: z.string().nullable().default(null),
  /** The Village person who will actually go. */
  helperId: z.string().nullable().default(null),
  /** Note for the parent, already in their language. */
  noteForParent: z.string().max(240).default(""),
  doneAt: iso.nullable().default(null),
  createdAt: iso,
});

// ---------- Village (trusted local people around a parent) ----------
export const HelperSchema = z.object({
  id,
  name: z.string().min(1).max(60),
  role: z.enum(HELPER_ROLES).default("other"),
  /** Whose Village they belong to. */
  forMemberId: id,
  phone: z.string().max(30).default(""),
  note: z.string().max(160).default(""),
  addedBy: id,
  createdAt: iso,
});

/**
 * Who handles what for a home ("Arjun handles groceries for Maa & Papa").
 * A new need of that kind goes straight to them. id = `${forMemberId}:${kind}`.
 */
export const DutySchema = z.object({
  id,
  forMemberId: id,
  kind: z.enum(NEED_KINDS),
  memberId: id,
  updatedAt: iso,
});

/** Siblings take turns being the one who checks in this week. */
export const RotaSchema = z.object({
  id, // = forMemberId
  forMemberId: id,
  order: z.array(id).min(1).max(12),
  startWeek: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  updatedAt: iso,
});

// ---------- Sit together ----------
export const SittingSchema = z.object({
  id,
  reason: z.enum(SITTING_REASONS),
  title: z.string().min(1).max(80),
  hostId: id,
  startsAt: iso,
  invites: z.array(id).default([]),
  recipeId: z.string().nullable().default(null),
  note: z.string().max(200).default(""),
  /** The moment kept afterwards: a card in Memory Lane. */
  keptCardId: z.string().nullable().default(null),
  /** RSVPs: who said they'll be there, and who can't make it. */
  going: z.array(id).default([]),
  cantMake: z.array(id).default([]),
  createdAt: iso,
});

/** "Come sit with me" — a knock on the courtyard door, not a meeting. */
export const KnockSchema = z.object({
  id,
  memberId: id,
  note: z.string().max(80).default(""),
  at: iso,
  until: iso,
});

// ---------- The weekly question (story keeper) ----------
export const QuestionSchema = z.object({
  id,
  toMemberId: id,
  text: z.string().min(4).max(200),
  /** Language the question is written in (the elder's own). */
  lang: z.string().default("en"),
  /** Optional: a grandchild asked this, Muse only phrased it. */
  askedBy: z.string().nullable().default(null),
  topic: z.enum(["story", "recipe", "wisdom", "song", "place"]).default("story"),
  answeredCardId: z.string().nullable().default(null),
  madeBy: z.enum(["family", "muse"]).default("muse"),
  createdAt: iso,
});

// ---------- Muse call log (what powered by Muse actually did) ----------
export const MuseCallSchema = z.object({
  id,
  purpose: z.string().max(120),
  model: z.string().max(80),
  cached: z.boolean().default(false),
  ok: z.boolean().default(true),
  ms: z.number().int().min(0).default(0),
  cost: z.number().min(0).default(0),
  at: iso,
});

export const DOC_SCHEMAS = {
  recipe: RecipeSchema,
  attempt: AttemptSchema,
  presence: PresenceSchema,
  care_settings: CareSettingsSchema,
  need: NeedSchema,
  helper: HelperSchema,
  rota: RotaSchema,
  duty: DutySchema,
  sitting: SittingSchema,
  knock: KnockSchema,
  question: QuestionSchema,
  muse_call: MuseCallSchema,
} as const;

export type DocKind = keyof typeof DOC_SCHEMAS;
export type DocOf<K extends DocKind> = z.infer<(typeof DOC_SCHEMAS)[K]>;

export type Recipe = DocOf<"recipe">;
export type Attempt = DocOf<"attempt">;
export type Presence = DocOf<"presence">;
export type PresenceMoment = z.infer<typeof PresenceMomentSchema>;
export type CareSettings = DocOf<"care_settings">;
export type Need = DocOf<"need">;
export type Helper = DocOf<"helper">;
export type Rota = DocOf<"rota">;
export type Duty = DocOf<"duty">;
export type Sitting = DocOf<"sitting">;
export type Knock = DocOf<"knock">;
export type Question = DocOf<"question">;
export type MuseCall = DocOf<"muse_call">;
