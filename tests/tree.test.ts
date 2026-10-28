import { beforeEach, describe, expect, it } from "vitest";
import { DELETE as removeMember, PATCH as editMember } from "@/app/api/members/[id]/route";
import { POST as addRelative } from "@/app/api/relationships/route";
import { GET as getMembers } from "@/app/api/members/route";
import { inferRole } from "@/lib/db";
import { resetDemo } from "@/lib/store";
import { resetDocs } from "@/lib/family-docs";
import { authedGet, authedJson, sessionCookie } from "./auth-helper";

const call = (method: string, id: string, body?: unknown, member = "leo", family = "demo-family") =>
  new Request(`http://test/api/members/${id}`, {
    method,
    headers: { "content-type": "application/json", cookie: sessionCookie(member, family) },
    body: body ? JSON.stringify(body) : undefined,
  });

async function members(member = "leo") {
  return ((await (await getMembers(authedGet("http://test/api/members", member))).json()) as { members: { id: string; displayName: string; role: string; tz: string; birthday: string }[] }).members;
}

describe("family tree: add, edit, remove", () => {
  beforeEach(() => {
    resetDemo();
    resetDocs();
  });

  it("adds a relative of someone else (Dad's mother), not only of yourself", async () => {
    const res = await addRelative(authedJson("http://test/api/relationships", { memberId: "arjun", newMemberName: "Meera", relation: "mother", tz: "Asia/Kolkata" }, "leo"));
    expect(res.status).toBe(201);
    const meera = (await members()).find((m) => m.displayName === "Meera");
    expect(meera).toMatchObject({ role: "elder", tz: "Asia/Kolkata", birthday: "" });
  });

  it("never anchors to a member of another family", async () => {
    const res = await addRelative(
      new Request("http://test/api/relationships", {
        method: "POST",
        headers: { "content-type": "application/json", cookie: sessionCookie("m-x", "fam-other") },
        body: JSON.stringify({ memberId: "arjun", newMemberName: "Intruder", relation: "son" }),
      }),
    );
    expect(res.status).toBe(404);
  });

  it("infers a generation from the relation", () => {
    expect(inferRole("mother", "adult")).toBe("elder");
    expect(inferRole("son", "adult")).toBe("child");
    expect(inferRole("daughter", "elder")).toBe("adult");
    expect(inferRole("wife", "adult")).toBe("adult");
  });

  it("edits a person's name, place and birthday; rejects an unknown zone", async () => {
    const ok = await editMember(call("PATCH", "dadi", { displayName: "Nani", tz: "Asia/Kolkata", birthday: "02-10" }), { params: { id: "dadi" } });
    expect(ok.status).toBe(200);
    expect((await members()).find((m) => m.id === "dadi")).toMatchObject({ displayName: "Nani", birthday: "02-10" });
    const bad = await editMember(call("PATCH", "dadi", { tz: "Mars/Base" }), { params: { id: "dadi" } });
    expect(bad.status).toBe(400);
  });

  it("removes a person and their edges; you can't remove yourself here", async () => {
    const gone = await removeMember(call("DELETE", "aria"), { params: { id: "aria" } });
    expect(gone.status).toBe(200);
    expect((await members()).some((m) => m.id === "aria")).toBe(false);
    const self = await removeMember(call("DELETE", "leo"), { params: { id: "leo" } });
    expect(self.status).toBe(409);
  });
});
