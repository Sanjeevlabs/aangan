import { beforeEach, describe, expect, it } from "vitest";
import { DELETE as cardDelete, PATCH as cardPatch } from "@/app/api/cards/[id]/route";
import { POST as carePost } from "@/app/api/care/route";
import { DELETE as inviteDelete, POST as invitePost } from "@/app/api/invites/route";
import { POST as keeperPost } from "@/app/api/keeper/route";
import { POST as kitchenPost } from "@/app/api/kitchen/route";
import { DELETE as memberDelete, PATCH as memberPatch } from "@/app/api/members/[id]/route";
import { DELETE as presenceDelete, POST as presencePost } from "@/app/api/presence/route";
import { DELETE as unlink } from "@/app/api/relationships/[id]/route";
import { POST as link } from "@/app/api/relationships/link/route";
import { POST as addRelative } from "@/app/api/relationships/route";
import { POST as sitPost } from "@/app/api/sit/route";
import { dbAddCard, dbListRelationships } from "@/lib/db";
import { can, canChange } from "@/lib/permissions";
import { resetDemo } from "@/lib/store";
import { sessionCookie } from "./auth-helper";

const req = (url: string, member: string, body?: unknown, method = body === undefined ? "GET" : "POST") =>
  new Request(`http://test${url}`, { method, headers: { "content-type": "application/json", cookie: sessionCookie(member) }, body: body === undefined ? undefined : JSON.stringify(body) });
const json = async <T = Record<string, unknown>>(r: Response | Promise<Response>) => (await (await r).json()) as T;
const id = (x: string) => ({ params: { id: x } });

beforeEach(() => resetDemo());

describe("access roles", () => {
  it("the table: admin manages, member cares, child shares", () => {
    expect(can({ access: "admin" }, "roles.assign")).toBe(true);
    expect(can({ access: "member" }, "roles.assign")).toBe(false);
    expect(can({ access: "member" }, "care.manage")).toBe(true);
    expect(can({ access: "child" }, "tree.add")).toBe(false);
    expect(canChange({ id: "a", access: "member" }, "a", "edit")).toBe(true);
    expect(canChange({ id: "a", access: "member" }, "b", "delete")).toBe(false);
    expect(canChange({ id: "a", access: "admin" }, "b", "delete")).toBe(true);
    expect(canChange({ id: "a", access: "admin" }, "b", "edit")).toBe(false);
  });

  it("only an admin assigns roles, and the family always keeps one admin", async () => {
    expect((await memberPatch(req("/api/members/leo", "leo", { access: "admin" }, "PATCH"), id("leo"))).status).toBe(403);
    expect((await memberPatch(req("/api/members/arjun", "arjun", { access: "member" }, "PATCH"), id("arjun"))).status).toBe(409);
    expect((await memberPatch(req("/api/members/leo", "arjun", { access: "admin" }, "PATCH"), id("leo"))).status).toBe(200);
    expect((await memberPatch(req("/api/members/arjun", "arjun", { access: "member" }, "PATCH"), id("arjun"))).status).toBe(200);
  });

  it("a child can't change the tree, invite, or run care", async () => {
    expect((await addRelative(req("/api/relationships", "aria", { memberId: "aria", newMemberName: "Zoe", relation: "sister" }))).status).toBe(403);
    expect((await memberDelete(req("/api/members/dadi", "aria", undefined, "DELETE"), id("dadi"))).status).toBe(403);
    expect((await invitePost(req("/api/invites", "aria", {}))).status).toBe(403);
    expect((await carePost(req("/api/care", "aria", { action: "helper", forMemberId: "dadi", name: "X" }))).status).toBe(403);
  });
});

describe("tree links", () => {
  it("links two people already here, refuses duplicates, and unlinks", async () => {
    const made = await json<{ relationship: { id: string } }>(link(req("/api/relationships/link", "leo", { memberId: "aria", relationMemberId: "leo", relation: "brother" })));
    expect((await link(req("/api/relationships/link", "leo", { memberId: "leo", relationMemberId: "aria", relation: "sister" }))).status).toBe(409);
    expect((await unlink(req(`/api/relationships/${made.relationship.id}`, "leo", undefined, "DELETE"), id(made.relationship.id))).status).toBe(200);
    expect((await dbListRelationships("demo-family")).some((r) => r.id === made.relationship.id)).toBe(false);
  });
});

describe("content ownership", () => {
  it("the author edits or deletes a card; others can't; an admin may delete", async () => {
    const card = await dbAddCard({ familyId: "demo-family", type: "audio", caption: "Hello Dadi", lang: "en", takenAt: new Date().toISOString(), authorId: "leo" });
    expect((await cardPatch(req(`/api/cards/${card.id}`, "dadi", { caption: "Mine now" }, "PATCH"), id(card.id))).status).toBe(403);
    expect((await json<{ card: { caption: string } }>(cardPatch(req(`/api/cards/${card.id}`, "leo", { caption: "Hello Dadi and Dada" }, "PATCH"), id(card.id)))).card.caption).toBe("Hello Dadi and Dada");
    expect((await cardDelete(req(`/api/cards/${card.id}`, "dadi", undefined, "DELETE"), id(card.id))).status).toBe(403);
    expect((await cardDelete(req(`/api/cards/${card.id}`, "arjun", undefined, "DELETE"), id(card.id))).status).toBe(200);
  });

  it("revokes an invite (admin)", async () => {
    const inv = await json<{ invite: { code: string } }>(invitePost(req("/api/invites", "leo", {})));
    expect((await inviteDelete(req("/api/invites", "leo", { code: inv.invite.code }, "DELETE"))).status).toBe(403);
    expect((await inviteDelete(req("/api/invites", "arjun", { code: inv.invite.code }, "DELETE"))).status).toBe(200);
  });

  it("a recipe belongs to its cook; attempts to their author", async () => {
    expect((await kitchenPost(req("/api/kitchen", "leo", { action: "edit", recipeId: "recipe-dadi-dal", title: "Leo's dal", ingredients: [{ item: "dal" }], steps: [{ text: "cook" }] }))).status).toBe(403);
    const edited = await json<{ recipe: { title: string; madeBy: string } }>(kitchenPost(req("/api/kitchen", "dadi", { action: "edit", recipeId: "recipe-dadi-dal", title: "Dadi's Sunday dal", ingredients: [{ item: "toor dal", said: "one katori" }], steps: [{ text: "Wash it three times." }] })));
    expect(edited.recipe).toMatchObject({ title: "Dadi's Sunday dal", madeBy: "family" });
    expect((await kitchenPost(req("/api/kitchen", "dadi", { action: "delete-attempt", attemptId: "cooked-leo-dal" }))).status).toBe(403);
    expect((await kitchenPost(req("/api/kitchen", "leo", { action: "delete-attempt", attemptId: "cooked-leo-dal" }))).status).toBe(200);
    expect((await kitchenPost(req("/api/kitchen", "dadi", { action: "delete-recipe", recipeId: "recipe-dadi-dal" }))).status).toBe(200);
  });

  it("questions: the asker withdraws, the elder skips, others can't", async () => {
    expect((await keeperPost(req("/api/keeper", "aria", { action: "remove", questionId: "q-leo-paratha" }))).status).toBe(403);
    expect((await keeperPost(req("/api/keeper", "leo", { action: "remove", questionId: "q-leo-paratha" }))).status).toBe(200);
    expect((await keeperPost(req("/api/keeper", "dadi", { action: "remove", questionId: "q-dadi-week" }))).status).toBe(200);
  });

  it("you can undo only your own moment", async () => {
    const p = await json<{ presence: { id: string } }>(presencePost(req("/api/presence", "dadi", { moment: "garden" })));
    expect((await presenceDelete(req("/api/presence", "leo", { presenceId: p.presence.id }, "DELETE"))).status).toBe(403);
    expect((await presenceDelete(req("/api/presence", "dadi", { presenceId: p.presence.id }, "DELETE"))).status).toBe(200);
  });
});

describe("care duties and edits", () => {
  it("a need goes straight to whoever handles that kind for the home", async () => {
    await carePost(req("/api/care", "arjun", { action: "duty-set", forMemberId: "dada", kind: "groceries", memberId: "arjun" }));
    const made = await json<{ need: { status: string; claimedBy: string; noteForParent: string } }>(carePost(req("/api/care", "dadi", { action: "need", forMemberId: "dadi", title: "Milk and atta", kind: "groceries" })));
    expect(made.need).toMatchObject({ status: "claimed", claimedBy: "arjun" });
    expect(made.need.noteForParent).toContain("groceries");
  });

  it("the parent edits or withdraws their own need; a child can't manage care", async () => {
    const made = await json<{ need: { id: string } }>(carePost(req("/api/care", "dadi", { action: "need", forMemberId: "dadi", title: "Fan is noisy", kind: "repair" })));
    const ed = await json<{ need: { title: string } }>(carePost(req("/api/care", "dadi", { action: "need-edit", needId: made.need.id, title: "Ceiling fan is noisy", kind: "repair" })));
    expect(ed.need.title).toBe("Ceiling fan is noisy");
    expect((await carePost(req("/api/care", "aria", { action: "need-delete", needId: made.need.id }))).status).toBe(403);
    expect((await carePost(req("/api/care", "dadi", { action: "need-delete", needId: made.need.id }))).status).toBe(200);
    const h = await json<{ helper: { phone: string } }>(carePost(req("/api/care", "arjun", { action: "helper-edit", helperId: "helper-ramesh", name: "Ramesh", role: "groceries", phone: "+91 90000 11111" })));
    expect(h.helper.phone).toBe("+91 90000 11111");
  });
});

describe("sit together RSVPs", () => {
  it("answers once per person; a new time resets answers", async () => {
    await sitPost(req("/api/sit", "dadi", { action: "rsvp", sittingId: "sit-dal", answer: "going" }));
    const s = await json<{ sitting: { going: string[]; cantMake: string[] } }>(sitPost(req("/api/sit", "dadi", { action: "rsvp", sittingId: "sit-dal", answer: "cant" })));
    expect(s.sitting).toMatchObject({ going: [], cantMake: ["dadi"] });
    expect((await sitPost(req("/api/sit", "dadi", { action: "reschedule", sittingId: "sit-dal", startsAt: new Date(Date.now() + 86_400_000).toISOString() }))).status).toBe(403);
    const moved = await json<{ sitting: { cantMake: string[] } }>(sitPost(req("/api/sit", "leo", { action: "reschedule", sittingId: "sit-dal", startsAt: new Date(Date.now() + 2 * 86_400_000).toISOString() })));
    expect(moved.sitting.cantMake).toEqual([]);
  });
});
