// A failed write to the live database must surface as an error, not as a
// success kept in this isolate's memory (Workers don't share memory).
// Live is simulated like tests/demo-isolation.test.ts, with a fake client
// whose inserts and upserts fail for the tables in `failOn`.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => {
  const state = { calls: [] as string[], failOn: new Set<string>() };
  const fake = {
    from: (t: string) => {
      const write = (op: string) => () => {
        state.calls.push(`${op}:${t}`);
        return Promise.resolve({ data: null, error: state.failOn.has(t) ? { message: "boom" } : null });
      };
      const read: unknown = new Proxy(function () {}, {
        get(_t, prop) {
          if (prop === "then") return (resolve: (v: unknown) => void) => resolve({ data: [], error: null, count: 0 });
          if (prop === "maybeSingle") return () => Promise.resolve({ data: null, error: null });
          if (prop === "insert") return write("insert");
          if (prop === "upsert") return write("upsert");
          return () => read;
        },
      });
      return read;
    },
  };
  return { state, fake };
});

vi.mock("@/lib/supabase", () => ({ isDbLive: () => true, supabaseServer: () => h.fake }));

import { guardWrites } from "@/lib/api-guard";
import { dbAddCard, dbAddRelationship, dbAddSuggestion, dbCreateInvite, dbSetReaction } from "@/lib/db";
import { DbWriteError } from "@/lib/family-db";
import { putDoc, resetDocs } from "@/lib/family-docs";
import { resetEvents } from "@/lib/gather-store";
import { setRitualSettings } from "@/lib/occasion-settings";

const REAL = "fam-real0000001";

beforeEach(() => {
  vi.stubEnv("MOCK", "false");
  vi.stubEnv("META_API_KEY", "test-not-a-key");
  h.state.calls = [];
  h.state.failOn = new Set(["cards", "suggestions", "invites", "reactions", "family_docs"]);
  resetDocs();
  resetEvents();
});
afterEach(() => vi.unstubAllEnvs());

describe("live write failures", () => {
  it("db writes throw DbWriteError instead of falling back to memory", async () => {
    await expect(dbAddCard({ familyId: REAL, type: "photo", caption: "x", lang: "en", takenAt: new Date().toISOString(), source: "upload" })).rejects.toBeInstanceOf(DbWriteError);
    await expect(dbAddSuggestion({ goal: "g", familyId: REAL })).rejects.toBeInstanceOf(DbWriteError);
    await expect(dbCreateInvite(REAL)).rejects.toBeInstanceOf(DbWriteError);
    await expect(dbSetReaction({ cardId: crypto.randomUUID(), memberId: "m1", kind: "love", familyId: REAL })).rejects.toBeInstanceOf(DbWriteError);
  });

  it("doc and settings writes throw too", async () => {
    await expect(setRitualSettings(REAL, { kept: ["diwali"] }, "m1")).rejects.toBeInstanceOf(DbWriteError);
    await expect(putDoc(REAL, "day_line", { id: "m1", memberId: "m1", text: "Hello", until: new Date().toISOString(), createdAt: new Date().toISOString() })).rejects.toThrow();
  });

  it("relationship: a failed member insert never touches relationships", async () => {
    h.state.failOn = new Set(["members"]);
    await expect(dbAddRelationship({ memberId: "m1", newMemberName: "Tara", relation: "sister", familyId: REAL })).rejects.toBeInstanceOf(DbWriteError);
    expect(h.state.calls).toEqual(["insert:members"]);
  });

  it("relationship: members first, then relationships", async () => {
    h.state.failOn = new Set();
    const out = await dbAddRelationship({ memberId: "m1", newMemberName: "Tara", relation: "sister", familyId: REAL });
    expect(out.member.firstName).toBe("Tara");
    expect(h.state.calls).toEqual(["insert:members", "insert:relationships"]);
  });

  it("guardWrites turns DbWriteError into 503 save-failed and rethrows anything else", async () => {
    const bad = guardWrites(async () => {
      throw new DbWriteError("cards", "boom");
    });
    const res = await bad();
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ error: "save-failed" });
    await expect(guardWrites(async () => Promise.reject(new Error("other")))()).rejects.toThrow("other");
  });
});
