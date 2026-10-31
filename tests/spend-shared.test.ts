import { describe, expect, it } from "vitest";
import { memoryStore, SpendLedger } from "@/lib/llm";
import { SPEND_CAP_USD } from "@/lib/config";

class FakeShared extends SpendLedger {
  shared = 0;
  protected async sync(delta: number): Promise<void> {
    this.shared += delta;
    this.total = Math.max(this.total, this.shared);
  }
}

describe("the spend cap holds across instances", () => {
  it("one instance sees what another spent before its next paid call", async () => {
    const a = new FakeShared(memoryStore());
    const b = new FakeShared(memoryStore());
    await a.commit(SPEND_CAP_USD - 1);
    b.shared = a.shared; // both read the same database row
    expect(await b.check(2)).toBe(false);
    expect(await b.check(0.5)).toBe(true);
  });

  it("without a database it is the local total, as before", async () => {
    const l = new SpendLedger(memoryStore());
    await l.commit(SPEND_CAP_USD);
    expect(await l.check(0.01)).toBe(false);
  });
});
