import { z } from "zod";

// Caption may only reference tagged members (enforced in lib/grounding.ts).
export const CaptionSchema = z.object({
  caption: z.string().min(10).max(280),
  language: z.string().min(2).max(8),
  names: z.array(z.string()).default([]),
  takenAt: z.string().datetime().nullable(),
});

export const TranscriptSchema = z.object({
  transcript: z.string().min(1),
  summary: z.string().min(5).max(500),
  language: z.string().min(2).max(8),
});

export const RitualStepSchema = z.object({
  key: z.string(),
  kind: z.enum(["photo", "audio", "video", "text"]),
  prompt: z.string(),
  cardTemplate: z.string(),
});

export const RitualConfigSchema = z.object({
  slug: z.string(),
  title: z.string(),
  cultureNotes: z.string(),
  steps: z.array(RitualStepSchema).min(1),
});

export const CardSourceSchema = z.enum(["upload", "today", "glasses", "ritual", "agent"]);

export const CardSchema = z.object({
  id: z.string(),
  familyId: z.string(),
  type: z.enum(["photo", "audio", "video"]),
  caption: z.string(),
  summary: z.string().default(""),
  lang: z.string(),
  takenAt: z.string().datetime(),
  ritualSlug: z.string().nullable().default(null),
  source: CardSourceSchema.default("upload"),
  mediaRef: z.string().nullable().default(null),
  peaks: z.array(z.number().min(0).max(1)).default([]),
  palette: z.array(z.string()).default([]),
});

export const MemberRoleSchema = z.enum(["elder", "adult", "child"]);

export const MemberSchema = z.object({
  id: z.string(),
  familyId: z.string(),
  firstName: z.string(),
  displayName: z.string(),
  role: MemberRoleSchema,
  lang: z.string().default("en"),
  tz: z.string().default("UTC"),
  birthday: z.string().regex(/^\d{2}-\d{2}$/),
  homeImageRef: z.string().nullable().default(null),
  homePalette: z.array(z.string()).default([]),
});

export const CreateCardRequestSchema = z.object({
  type: z.enum(["photo", "audio", "video"]),
  caption: z.string().max(280).default(""),
  lang: z.string().min(2).max(8).default("en"),
  takenAt: z.string().datetime(),
  source: CardSourceSchema.default("upload"),
  mediaRef: z.string().nullable().default(null),
  peaks: z.array(z.number().min(0).max(1)).max(128).default([]),
  palette: z.array(z.string()).max(5).default([]),
});

export const HomeImageRequestSchema = z.object({
  memberId: z.string(),
  mediaRef: z.string(),
  palette: z.array(z.string()).max(5).default([]),
});

export type Caption = z.infer<typeof CaptionSchema>;
export type Transcript = z.infer<typeof TranscriptSchema>;
export type RitualConfig = z.infer<typeof RitualConfigSchema>;
export type Card = z.infer<typeof CardSchema>;
export type CardSource = z.infer<typeof CardSourceSchema>;
export type Member = z.infer<typeof MemberSchema>;
