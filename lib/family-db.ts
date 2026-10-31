// Which store serves a family: the live database for real families and for
// each demo visitor's copy (lib/demo-sandbox.ts), the in-memory seed only for
// the seed itself (DEMO_FAMILY_IDS). With the database live nobody holds a
// session on the seed: memory isn't shared between Worker isolates, so writes
// there would vanish on the next request.
// Server only (returns the service-role client).
import type { SupabaseClient } from "@supabase/supabase-js";
import { isSeedFamily } from "./family";
import { isDbLive, supabaseServer } from "./supabase";

/**
 * True when the database is on at all (keys present, MOCK off). Deliberately
 * independent of the model key: a missing or rotated META_API_KEY turns Muse
 * off, never the family's data.
 */
export function dbLive(): boolean {
  return process.env.MOCK !== "true" && isDbLive();
}

/**
 * The database client for this family's data, or null when it must stay in
 * memory (mock mode, no keys, or a demo family). A missing family id means
 * data that isn't tied to one family; it follows dbLive().
 */
export function dbFor(familyId: string | null | undefined): SupabaseClient | null {
  if (!dbLive()) return null;
  if (familyId && isSeedFamily(familyId)) return null;
  return supabaseServer();
}
