import { describe, expect, it } from "vitest";
import { activeProvider } from "@/lib/config";
import { captionCard, memoryStore, SpendLedger } from "@/lib/llm";

describe("LLM client (mock mode)", () => {
  it("returns a schema-valid caption", async () => {
    const { caption } = await captionCard("a family dinner photo", { mediaId: "m1" });
    expect(caption.caption.length).toBeGreaterThanOrEqual(10);
    expect(caption.caption.length).toBeLessThanOrEqual(280);
  });

  it("cache hit returns the same caption at zero cost", async () => {
    const store = memoryStore();
    const first = await captionCard("a birthday song", { mediaId: "m2", store });
    const second = await captionCard("a birthday song", { mediaId: "m2", store });
    expect(first.cached).toBe(false);
    expect(second.cached).toBe(true);
    expect(second.cost).toBe(0);
    expect(second.caption).toEqual(first.caption);
  });

  it("spend cap blocks further paid calls", () => {
    const store = memoryStore();
    store.set("spend:total", "119.995");
    const ledger = new SpendLedger(store);
    expect(ledger.canSpend(0.01)).toBe(false);
    expect(ledger.canSpend(0)).toBe(true);
  });

  it("spend ledger records costs cumulatively", () => {
    const ledger = new SpendLedger(memoryStore());
    ledger.record(0.5);
    ledger.record(0.25);
    expect(ledger.total).toBeCloseTo(0.75);
    expect(ledger.canSpend(120)).toBe(false);
  });

  it("falls back safely when no key and no mock", async () => {
    const prevMock = process.env.MOCK;
    const prevKey = process.env.META_API_KEY;
    process.env.MOCK = "";
    delete process.env.META_API_KEY;
    try {
      const { caption } = await captionCard("anything", { mediaId: "m3", store: memoryStore() });
      expect(caption.caption.length).toBeGreaterThan(0);
    } finally {
      process.env.MOCK = prevMock;
      if (prevKey !== undefined) process.env.META_API_KEY = prevKey;
    }
  });

  it("routes to meta by default, baseten only with confirmed credits", () => {
    delete process.env.BASETEN_CREDITS_CONFIRMED;
    expect(activeProvider()).toBe("meta");
    process.env.BASETEN_CREDITS_CONFIRMED = "1";
    expect(activeProvider()).toBe("baseten");
    delete process.env.BASETEN_CREDITS_CONFIRMED;
  });
});
