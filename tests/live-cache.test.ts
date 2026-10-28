import { describe, expect, it } from "vitest";
import { memoryStore, SpendLedger, translateText } from "@/lib/llm";

// Manual live prompt-caching check. Skipped by default and never in CI.
// Run with META_API_KEY in the environment (MOCK must not be "true"):
//   $env:RUN_LIVE_CACHE="1"; $env:MOCK=""; npx vitest run tests/live-cache.test.ts
const RUN = process.env.RUN_LIVE_CACHE === "1" && !!process.env.META_API_KEY;

describe.skipIf(!RUN)("live cache check", () => {
  it("second identical translate is served from cache at zero cost", { timeout: 120000 }, async () => {
    const store = memoryStore();
    const ledger = new SpendLedger(store);
    const first = await translateText("Good morning, my love.", "hi-deva", { store, ledger });
    const second = await translateText("Good morning, my love.", "hi-deva", { store, ledger });
    expect(first.cached).toBe(false);
    expect(second.cached).toBe(true);
    expect(second.cost).toBe(0);
    console.log(`cache check: first=$${first.cost.toFixed(2)} cached=${first.cached}, second=$${second.cost.toFixed(2)} cached=${second.cached}`);
  });
});
