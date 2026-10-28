import { beforeEach, describe, expect, it } from "vitest";
import { getMovableDate, groundingPrompt, parseGroundedDate, resolveMovableDates } from "@/lib/movable-dates";
import { memoryStore, SpendLedger } from "@/lib/llm";
import { getMovableCache, resetDemo, setMovableCache } from "@/lib/store";

// Fix 5 (01_api_fundamentals/10): live search grounding cached per year,
// fixture only as fallback. All live I/O is injected; no network here.
describe("movable-date grounding", () => {
  beforeEach(() => resetDemo());

  it("parses only an ISO date in the requested year", () => {
    expect(parseGroundedDate("2026-11-08", 2026)).toBe("2026-11-08");
    expect(parseGroundedDate("The date is 2026-11-08.", 2026)).toBe("2026-11-08");
    expect(parseGroundedDate("2025-11-08", 2026)).toBeNull();
    expect(parseGroundedDate("November 8", 2026)).toBeNull();
    expect(parseGroundedDate("2026-13-40", 2026)).toBeNull();
  });

  it("mock mode uses the fixture without any model call", async () => {
    const result = await getMovableDate("diwali", "Diwali", 2026, {
      fixture: () => "2026-11-08",
    });
    expect(result.source).toBe("fixture");
    expect(result.date).toBe("2026-11-08");
    expect(result.cost).toBe(0);
  });

  it("persistent cache wins over live and records sources", async () => {
    setMovableCache("diwali", 2026, "2026-11-08", ["https://example.com/diwali"]);
    let calls = 0;
    const result = await getMovableDate("diwali", "Diwali", 2026, {
      getPersistent: async (slug, year) => getMovableCache(slug, year),
      setPersistent: async () => undefined,
      fetchGrounded: async () => {
        calls += 1;
        return { text: "2026-10-20", citations: [], cost: 0.01 };
      },
      fixture: () => null,
    });
    expect(result.source).toBe("cache");
    expect(result.date).toBe("2026-11-08");
    expect(calls).toBe(0);
  });

  it("unparseable live output falls back to the fixture", async () => {
    const store = memoryStore();
    const result = await getMovableDate("diwali", "Diwali", 2026, {
      store,
      ledger: new SpendLedger(store),
      getPersistent: async () => undefined,
      setPersistent: async () => undefined,
      fetchGrounded: async () => ({ text: "sometime in autumn", citations: [], cost: 0 }),
      fixture: () => "2026-11-08",
    });
    expect(result.source).toBe("fixture");
    expect(result.date).toBe("2026-11-08");
  });

  it("rolls a stale year over to the next year", async () => {
    const seen: string[] = [];
    const { dates, grounded } = await resolveMovableDates([{ slug: "diwali", title: "Diwali" }], new Date("2026-12-01T00:00:00Z"), {
      getPersistent: async () => undefined,
      setPersistent: async () => undefined,
      fixture: () => null,
      fetchGrounded: async (prompt) => {
        seen.push(prompt);
        return { text: prompt.includes("2027") ? "2027-10-31" : "2026-11-08", citations: [], cost: 0 };
      },
    });
    // 2026-11-08 is stale by Dec 2026 -> next-year lookup runs too.
    expect(seen.some((p) => p.includes("2026"))).toBe(true);
    expect(seen.some((p) => p.includes("2027"))).toBe(true);
    expect(dates.diwali).toBe("2027-10-31");
    expect(grounded).toBe(true);
    expect(groundingPrompt("Diwali", 2027)).toContain("2027");
  });
});
