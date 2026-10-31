// Which store serves a family: the live database for real families, the
// in-memory seed for the public demo. The demo Aangans (DEMO_FAMILY_IDS) never
// touch the database, for reads or writes: every visitor gets the same rich
// seed, and their changes stay in that server instance's memory.
// Server only (returns the service-role client).
import type { SupabaseClient } from "@supabase/supabase-js";
import { isMockMode } from "./config";
import { isDemoFamily } from "./family";
import { isDbLive, supabaseServer } from "./supabase";

/** True when the database is on at all (keys present, mock mode off). */
export function dbLive(): boolean {
  return !isMockMode() && isDbLive();
}

/**
 * A write to the live database failed. Thrown instead of quietly keeping the
 * row in this isolate's memory: on Workers memory isn't shared, so a "saved"
 * row would vanish on the next request while the caller was told it worked.
 * Routes turn it into a 503 "save-failed" (lib/api-guard.ts).
 */
export class DbWriteError extends Error {
  constructor(
    public readonly table: string,
    message: string,
  ) {
    super(`${table}: ${message}`);
    this.name = "DbWriteError";
  }
}

/**
 * The database client for this family's data, or null when it must stay in
 * memory (mock mode, no keys, or a demo family). A missing family id means
 * data that isn't tied to one family; it follows dbLive().
 */
export function dbFor(familyId: string | null | undefined): SupabaseClient | null {
  if (!dbLive()) return null;
  if (familyId && isDemoFamily(familyId)) return null;
  return supabaseServer();
}
