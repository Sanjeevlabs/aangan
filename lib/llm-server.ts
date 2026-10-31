import { memoryStore, SpendLedger, type LlmStore } from "./llm";
import { isDbLive, supabaseServer } from "./supabase";

// Module-level model cache + spend ledger shared by all API routes, so
// translations/transcripts/suggestions are cached per card + lang across
// requests.
export const serverStore: LlmStore = memoryStore();

const REFRESH_MS = 10_000;

/**
 * The USD cap must hold across every server instance (Cloudflare runs many
 * isolates, each with its own memory). With a live database the running total
 * lives in Postgres (`add_spend`, an atomic increment); each instance re-reads
 * it at most every 10 s before a paid call and adds every cost it records.
 * Without a database (mock, tests) it is the in-memory total, as before.
 */
export class SharedSpendLedger extends SpendLedger {
  private lastRead = 0;
  protected async sync(delta: number): Promise<void> {
    if (!isDbLive()) return;
    if (delta === 0 && Date.now() - this.lastRead < REFRESH_MS) return;
    const sb = supabaseServer();
    if (!sb) return;
    try {
      const { data, error } = await sb.rpc("add_spend", { c: delta });
      if (error) return;
      const shared = Number(data);
      // Never lower the total we know about: a failed earlier write must not reopen the cap.
      if (Number.isFinite(shared)) this.total = Math.max(this.total, shared);
      this.lastRead = Date.now();
    } catch {
      /* database unreachable: keep the local total */
    }
  }
}

export const serverLedger = new SharedSpendLedger(serverStore);
