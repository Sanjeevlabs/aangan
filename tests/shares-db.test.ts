// Public shares with the database live: Postgres is read on every lookup (a
// revoke made on another isolate is honoured); visitor copies of the demo are
// real database families, only the seed families stay in memory.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => {
  type Row = Record<string, unknown>;
  const shares: Row[] = [];
  function builder() {
    const filters: ((r: Row) => boolean)[] = [];
    let patch: Row | null = null;
    const run = () => {
      const hit = shares.filter((r) => filters.every((f) => f(r)));
      if (patch) hit.forEach((r) => Object.assign(r, patch));
      return { data: hit.map((r) => ({ ...r })), error: null };
    };
    const b: Record<string, unknown> = {
      select: () => b,
      eq: (k: string, v: unknown) => (filters.push((r) => r[k] === v), b),
      order: () => b,
      limit: () => b,
      update: (p: Row) => ((patch = p), b),
      maybeSingle: () => Promise.resolve({ data: run().data[0] ?? null, error: null }),
      then: (res: (v: unknown) => void) => res(run()),
    };
    return b;
  }
  const fake = {
    from: () => ({
      ...builder(),
      upsert: (r: Row) => {
        const at = shares.findIndex((x) => x.token === r.token);
        if (at >= 0) shares[at] = { ...shares[at], ...r };
        else shares.push({ views: 0, ...r });
        return Promise.resolve({ error: null });
      },
    }),
    rpc: () => Promise.resolve({ data: 0, error: null }),
  };
  return { shares, fake };
});

vi.mock("@/lib/supabase", () => ({ isDbLive: () => true, supabaseServer: () => h.fake }));

import { PublicRecipeSchema, createShare, getShare, resetShares, revokeShare } from "@/lib/shares";

const snapshot = PublicRecipeSchema.parse({ title: "Dal", from: "Dadi", course: "main", prepMins: 5, cookMins: 20, serves: "4", memory: "", prepWork: [], outcome: "", ingredients: [], steps: [] });
const input = (familyId: string) => ({ familyId, kind: "recipe" as const, refId: "c1", snapshot, createdBy: "m1" });

beforeEach(() => {
  vi.stubEnv("MOCK", "false");
  vi.stubEnv("META_API_KEY", "test-not-a-key");
  h.shares.length = 0;
  resetShares();
});
afterEach(() => vi.unstubAllEnvs());

describe("shares with the database live", () => {
  it("a sandbox family's share round-trips through the database", async () => {
    const s = await createShare(input("demo-v-0123456789ab"));
    expect(h.shares.length).toBe(1);
    resetShares(); // another isolate: nothing in memory
    expect((await getShare(s.token))?.familyId).toBe("demo-v-0123456789ab");
  });

  it("a revoke made elsewhere is honoured even when this isolate still holds the share", async () => {
    const s = await createShare(input("demo-v-0123456789ab"));
    h.shares[0].revoked_at = new Date().toISOString(); // revoked by another isolate
    expect(await getShare(s.token)).toBeNull();
  });

  it("revokeShare stops serving it", async () => {
    const s = await createShare(input("fam-0123456789ab"));
    expect(await getShare(s.token)).not.toBeNull();
    await revokeShare("fam-0123456789ab", s.token);
    expect(await getShare(s.token)).toBeNull();
  });

  it("the seed families stay in memory, not in the database", async () => {
    const s = await createShare(input("demo-family"));
    expect(h.shares.length).toBe(0);
    expect((await getShare(s.token))?.familyId).toBe("demo-family");
  });
});
