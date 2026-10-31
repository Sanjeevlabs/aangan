// getDoc reads one row by key when live, not a 500-row list filtered in code.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => {
  const state = { eqs: [] as string[], limited: false, row: null as unknown };
  const q: unknown = new Proxy(function () {}, {
    get(_t, prop) {
      if (prop === "maybeSingle") return () => Promise.resolve({ data: state.row, error: null });
      if (prop === "limit") return () => ((state.limited = true), q);
      if (prop === "eq") return (c: string, v: string) => (state.eqs.push(`${c}=${v}`), q);
      return () => q;
    },
  });
  return { state, fake: { from: () => q } };
});

vi.mock("@/lib/supabase", () => ({ isDbLive: () => true, supabaseServer: () => h.fake }));

import { getDoc } from "@/lib/family-docs";

beforeEach(() => {
  vi.stubEnv("MOCK", "false");
  vi.stubEnv("META_API_KEY", "test-not-a-key");
  h.state.eqs = [];
  h.state.limited = false;
});
afterEach(() => vi.unstubAllEnvs());

describe("getDoc (live)", () => {
  it("asks for the one row by id and kind", async () => {
    const at = new Date().toISOString();
    h.state.row = { data: { id: "m1", memberId: "m1", text: "Hi", until: at, createdAt: at } };
    const doc = await getDoc("fam-real0000001", "day_line", "m1");
    expect(doc?.text).toBe("Hi");
    expect(h.state.eqs).toEqual(["id=fam-real0000001:m1", "kind=day_line"]);
    expect(h.state.limited).toBe(false);
  });

  it("is undefined when there is no row", async () => {
    h.state.row = null;
    expect(await getDoc("fam-real0000001", "day_line", "nobody")).toBeUndefined();
  });
});
