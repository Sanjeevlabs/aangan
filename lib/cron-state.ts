// Tiny cursor store for cron jobs: a row in `cron_state` when the database is
// live (service client), otherwise a per-process map. Server only.
import { dbFor } from "./family-db";

const g = globalThis as typeof globalThis & { __aanganCron?: Map<string, Record<string, unknown>> };
const mem = (g.__aanganCron ??= new Map<string, Record<string, unknown>>());

export async function getCronState(id: string): Promise<Record<string, unknown>> {
  const sb = dbFor(null);
  if (!sb) return mem.get(id) ?? {};
  const { data, error } = await sb.from("cron_state").select("value").eq("id", id).maybeSingle();
  if (error) console.error("[cron-state] read failed", error.message);
  const v = (data as { value?: unknown } | null)?.value;
  return v && typeof v === "object" ? (v as Record<string, unknown>) : {};
}

export async function setCronState(id: string, value: Record<string, unknown>): Promise<void> {
  const sb = dbFor(null);
  if (!sb) {
    mem.set(id, value);
    return;
  }
  const { error } = await sb.from("cron_state").upsert({ id, value, updated_at: new Date().toISOString() }, { onConflict: "id" });
  if (error) console.error("[cron-state] write failed", error.message);
}

/** Real families scanned per cron invocation (the free plan allows ~50 subrequests). */
export const SCAN_PAGE = 15;

/** The next page after `cursor` (ids sorted), and the cursor to store: "" once the end is reached. */
export function pageFamilies(ids: string[], cursor: string, size = SCAN_PAGE): { batch: string[]; next: string } {
  const sorted = [...ids].sort();
  const batch = sorted.filter((id) => id > cursor).slice(0, size);
  const last = batch[batch.length - 1];
  return { batch, next: last && sorted.indexOf(last) < sorted.length - 1 ? last : "" };
}

export function resetCronState(): void {
  mem.clear();
}
