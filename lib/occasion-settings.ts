// "Festivals we keep": one family-level choice, never per person, never a
// religion. A list of ritual config slugs (rituals/*.json). Default: none,
// so a new family sees only birthdays until someone picks.
// Stored in the family_docs table like the other family docs (kind
// "ritual_settings", one row per family), validated with Zod on the way in
// and out; in-memory in mock mode and as a fallback. Server only.
import { z } from "zod";
import { isMockMode } from "./config";
import { isDbLive, supabaseServer } from "./supabase";

export const RitualSettingsSchema = z.object({
  id: z.literal("ritual-settings"),
  kept: z.array(z.string().min(1).max(60)).max(40).default([]),
  updatedBy: z.string().max(80).nullable().default(null),
  updatedAt: z.string().datetime(),
});
export type RitualSettings = z.infer<typeof RitualSettingsSchema>;

const KIND = "ritual_settings";
const ID = "ritual-settings";
const mem = new Map<string, RitualSettings>();

function live(): boolean {
  return !isMockMode() && isDbLive();
}

function empty(): RitualSettings {
  return { id: ID, kept: [], updatedBy: null, updatedAt: new Date(0).toISOString() };
}

export async function getRitualSettings(familyId: string): Promise<RitualSettings> {
  const local = mem.get(familyId);
  if (!live()) return local ?? empty();
  const sb = supabaseServer();
  if (!sb) return local ?? empty();
  const { data, error } = await sb.from("family_docs").select("data").eq("id", `${familyId}:${ID}`).eq("kind", KIND).maybeSingle();
  if (error || !data) return local ?? empty();
  const parsed = RitualSettingsSchema.safeParse((data as { data: unknown }).data);
  return parsed.success ? parsed.data : (local ?? empty());
}

/** The festival slugs this family keeps (birthdays are always kept). */
export async function keptFestivals(familyId: string): Promise<string[]> {
  return (await getRitualSettings(familyId)).kept;
}

export async function setKeptFestivals(familyId: string, kept: string[], by: string): Promise<RitualSettings> {
  const doc = RitualSettingsSchema.parse({ id: ID, kept: Array.from(new Set(kept)), updatedBy: by, updatedAt: new Date().toISOString() });
  mem.set(familyId, doc);
  if (!live()) return doc;
  const sb = supabaseServer();
  if (!sb) return doc;
  const { error } = await sb
    .from("family_docs")
    .upsert({ id: `${familyId}:${ID}`, family_id: familyId, kind: KIND, data: doc, updated_at: doc.updatedAt }, { onConflict: "id" });
  if (error) console.error("[ritual-settings] write failed, kept in memory", error.message);
  return doc;
}

export function resetRitualSettings(): void {
  mem.clear();
}
