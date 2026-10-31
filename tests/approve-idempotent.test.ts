import { beforeEach, describe, expect, it } from "vitest";
import { dbAddSuggestion, dbClaimSuggestion } from "@/lib/db";
import { listCards, resetDemo } from "@/lib/store";
import { sessionCookie } from "./auth-helper";
import { POST as approvePOST } from "@/app/api/suggestions/[id]/approve/route";

const approve = (id: string) =>
  approvePOST(new Request("http://test/api/approve", { method: "POST", headers: { cookie: sessionCookie() } }), { params: Promise.resolve({ id }) });

describe("approving a suggestion is idempotent", () => {
  beforeEach(() => resetDemo());

  it("two concurrent approvals make one card; the loser gets 409 already-decided", async () => {
    const s = await dbAddSuggestion({
      goal: "Keep a memory",
      payload: { action: "create_card", args: { type: "photo", caption: "Once only", lang: "en" } },
      familyId: "demo-family",
    });
    const before = listCards().length;
    const [a, b] = await Promise.all([approve(s.id), approve(s.id)]);
    expect([a.status, b.status].sort()).toEqual([200, 409]);
    expect(listCards().length).toBe(before + 1);
  });

  it("claim is one-shot and family-scoped", async () => {
    const s = await dbAddSuggestion({ goal: "x", payload: {}, familyId: "demo-family" });
    expect(await dbClaimSuggestion(s.id, "demo-iyer")).toBe(false);
    expect(await dbClaimSuggestion(s.id, "demo-family")).toBe(true);
    expect(await dbClaimSuggestion(s.id, "demo-family")).toBe(false);
  });
});
