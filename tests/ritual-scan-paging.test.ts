import { beforeEach, describe, expect, it } from "vitest";
import { POST as scanPOST } from "@/app/api/ritual-scan/route";
import { getCronState, pageFamilies, resetCronState, setCronState } from "@/lib/cron-state";
import { authedJson } from "./auth-helper";
import { resetDemo } from "@/lib/store";

describe("cron paging", () => {
  const ids = Array.from({ length: 35 }, (_, i) => `fam-${String(i).padStart(3, "0")}`).reverse();

  it("walks the families in id order, 15 at a time, and wraps at the end", () => {
    const a = pageFamilies(ids, "");
    expect(a.batch.length).toBe(15);
    expect(a.batch[0]).toBe("fam-000");
    const b = pageFamilies(ids, a.next);
    expect(b.batch[0]).toBe("fam-015");
    const c = pageFamilies(ids, b.next);
    expect(c.batch.length).toBe(5);
    expect(c.next).toBe(""); // next day starts over
    expect(pageFamilies(ids.slice(0, 15), "").next).toBe(""); // an exact fit doesn't waste a run
    expect(pageFamilies([], "").batch).toEqual([]);
  });

  it("keeps the cursor (memory fallback without a database)", async () => {
    resetCronState();
    expect(await getCronState("ritual-scan")).toEqual({});
    await setCronState("ritual-scan", { lastFamilyId: "fam-014" });
    expect((await getCronState("ritual-scan")).lastFamilyId).toBe("fam-014");
  });
});

describe("ritual scan skips quiet families", () => {
  beforeEach(() => resetDemo());

  it("a family with elders is still scanned", async () => {
    const out = (await (await scanPOST(authedJson("http://test/api/ritual-scan", {}))).json()) as { skipped?: boolean; rolesAssigned: number };
    expect(out.skipped).toBeUndefined();
    expect(out.rolesAssigned).toBeGreaterThan(0);
  });
});
