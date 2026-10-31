import { beforeEach, describe, expect, it } from "vitest";
import { dbCreateInvite, dbFindInvite } from "@/lib/db";
import { resetDemo } from "@/lib/store";
import { POST as sessionPOST } from "@/app/api/session/route";

let n = 0;
const exchange = (inviteCode: string, memberId: string) =>
  sessionPOST(
    new Request("http://test/api/session", {
      method: "POST",
      headers: { "content-type": "application/json", "x-forwarded-for": `10.9.0.${++n}` },
      body: JSON.stringify({ inviteCode, memberId }),
    }),
  );

describe("invite lookups and sessions", () => {
  beforeEach(() => resetDemo());

  it("dbFindInvite matches any case and ignores unknown codes", async () => {
    const inv = await dbCreateInvite("demo-family", "arjun");
    expect((await dbFindInvite(` ${inv.code.toLowerCase()} `))?.id).toBe(inv.id);
    expect(await dbFindInvite("NOPE1234")).toBeUndefined();
    expect(await dbFindInvite("   ")).toBeUndefined();
  });

  it("an invite code opens a grown-up's open place, in any case", async () => {
    const inv = await dbCreateInvite("demo-family", "arjun");
    const res = await exchange(inv.code.toLowerCase(), "dadi");
    expect(res.status).toBe(200);
  });

  it("an invite code never opens a child's profile", async () => {
    const inv = await dbCreateInvite("demo-family", "arjun");
    const res = await exchange(inv.code, "aria");
    expect(res.status).toBe(403);
    expect(((await res.json()) as { error: string }).error).toBe("not-claimable");
  });
});
