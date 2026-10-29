import { describe, expect, it } from "vitest";
import { activeProvider, failoverProvider, providerKey } from "@/lib/config";
import { captionCard, memoryStore, normalizeLangCode, SpendLedger } from "@/lib/llm";

describe("normalizeLangCode", () => {
  it("maps model language spellings to short codes", () => {
    expect(normalizeLangCode("Hindi", "en")).toBe("hi");
    expect(normalizeLangCode("HI", "en")).toBe("hi");
    expect(normalizeLangCode("hi-deva", "en")).toBe("hi-deva");
    expect(normalizeLangCode("Hindi (Devanagari)", "en")).toBe("hi-deva");
    expect(normalizeLangCode("Hinglish", "en")).toBe("hi-latn");
    expect(normalizeLangCode("English", "hi")).toBe("en");
    expect(normalizeLangCode("klingon", "en")).toBe("en");
  });
});

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

  it("routes to Meta by default; Baseten is primary only when asked and keyed, and fails over with its own key", () => {
    const prev = { p: process.env.MUSE_PROVIDER, k: process.env.BASETEN_API_KEY, m: process.env.META_API_KEY };
    try {
      delete process.env.MUSE_PROVIDER;
      delete process.env.BASETEN_API_KEY;
      expect(activeProvider()).toBe("meta");
      process.env.MUSE_PROVIDER = "baseten";
      expect(activeProvider()).toBe("meta"); // no Baseten key → stays on Meta
      process.env.BASETEN_API_KEY = "test-baseten";
      expect(activeProvider()).toBe("baseten");
      process.env.META_API_KEY = "x"; // not a key: a placeholder for the routing check
      expect(providerKey("baseten")).toBe("test-baseten");
      expect(providerKey("meta")).toBe("x");
      expect(failoverProvider("meta")).toBe("baseten");
      delete process.env.BASETEN_API_KEY;
      expect(failoverProvider("meta")).toBeNull();
    } finally {
      for (const [k, v] of [["MUSE_PROVIDER", prev.p], ["BASETEN_API_KEY", prev.k], ["META_API_KEY", prev.m]] as const) {
        if (v === undefined) delete process.env[k];
        else process.env[k] = v;
      }
    }
  });
});
