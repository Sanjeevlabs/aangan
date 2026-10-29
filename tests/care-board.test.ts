import { beforeEach, describe, expect, it } from "vitest";
import { GET as careGet, POST as carePost } from "@/app/api/care/route";
import { GET as petsGet, POST as petsPost } from "@/app/api/pets/route";
import { mockNeed } from "@/lib/care";
import { resetDemo } from "@/lib/store";
import { sessionCookie } from "./auth-helper";

const req = (url: string, member: string, body?: unknown) =>
  new Request(`http://test${url}`, { method: body === undefined ? "GET" : "POST", headers: { "content-type": "application/json", cookie: sessionCookie(member) }, body: body === undefined ? undefined : JSON.stringify(body) });
const json = async <T = Record<string, unknown>>(r: Response | Promise<Response>) => (await (await r).json()) as T;
type T = { id: string; status: string; claimedBy: string | null; history: { what: string }[]; recurring: string; dueAt: string | null; priority: string };

beforeEach(() => resetDemo());

describe("care board tickets", () => {
  it("assigns to a sibling, moves through statuses, and keeps a timeline", async () => {
    const made = await json<{ need: T }>(carePost(req("/api/care", "leo", { action: "need", forMemberId: "dada", title: "Fix the ceiling fan", kind: "repair", priority: "urgent" })));
    expect(made.need).toMatchObject({ status: "open", priority: "urgent" });
    const given = await json<{ need: T }>(carePost(req("/api/care", "leo", { action: "assign-to", needId: made.need.id, memberId: "arjun" })));
    expect(given.need).toMatchObject({ status: "claimed", claimedBy: "arjun" });
    const started = await json<{ need: T }>(carePost(req("/api/care", "arjun", { action: "status", needId: made.need.id, status: "progress" })));
    expect(started.need.status).toBe("progress");
    const done = await json<{ need: T; next: T | null }>(carePost(req("/api/care", "arjun", { action: "status", needId: made.need.id, status: "done" })));
    expect(done.need.status).toBe("done");
    expect(done.next).toBeNull();
    expect(done.need.history.map((h) => h.what)).toEqual(["Created", "Vihaan assigned it to Arjun", "Started", "Done"]);
  });

  it("can't be assigned to a child", async () => {
    const made = await json<{ need: T }>(carePost(req("/api/care", "arjun", { action: "need", forMemberId: "dadi", title: "Milk" })));
    expect((await carePost(req("/api/care", "arjun", { action: "assign-to", needId: made.need.id, memberId: "aria" }))).status).toBe(404);
  });

  it("a recurring task rolls forward to the next one when done", async () => {
    const due = "2026-11-01T04:30:00.000Z";
    const made = await json<{ need: T }>(carePost(req("/api/care", "arjun", { action: "need", forMemberId: "dadi", title: "Weekly groceries", kind: "groceries", recurring: "weekly", dueAt: due, assignee: "arjun" })));
    const done = await json<{ need: T; next: T }>(carePost(req("/api/care", "arjun", { action: "status", needId: made.need.id, status: "done" })));
    expect(done.next).toMatchObject({ status: "claimed", claimedBy: "arjun", recurring: "weekly", dueAt: "2026-11-08T04:30:00.000Z" });
    const all = await json<{ needs: T[] }>(careGet(req("/api/care", "arjun")));
    expect(all.needs.some((n) => n.id === done.next.id)).toBe(true);
  });

  it("classifies the new kinds from speech", () => {
    expect(mockNeed("Please pay the electricity bill this week").kind).toBe("bills");
    expect(mockNeed("Need someone to pick up my medicine refill").kind).toBe("health");
    expect(mockNeed("Bruno needs a vet appointment").kind).toBe("pets"); // pet words win over "appointment"
  });
});

describe("pets", () => {
  it("adds, edits and removes a pet in a home; a child can't", async () => {
    expect((await json<{ pets: unknown[] }>(petsGet(req("/api/pets", "leo")))).pets.length).toBeGreaterThanOrEqual(2);
    expect((await petsPost(req("/api/pets", "aria", { action: "add", name: "Goldie", species: "fish", livesWith: "aria" }))).status).toBe(403);
    const made = await json<{ pet: { id: string; name: string } }>(petsPost(req("/api/pets", "leo", { action: "add", name: "Pepper", species: "dog", livesWith: "leo", birthday: "05-04" })));
    const edited = await json<{ pet: { note: string } }>(petsPost(req("/api/pets", "leo", { action: "edit", petId: made.pet.id, name: "Pepper", species: "dog", livesWith: "leo", note: "Hates the vacuum" })));
    expect(edited.pet.note).toBe("Hates the vacuum");
    expect((await petsPost(req("/api/pets", "leo", { action: "add", name: "Ghost", species: "cat", livesWith: "nobody" }))).status).toBe(404);
    expect((await petsPost(req("/api/pets", "leo", { action: "remove", petId: made.pet.id }))).status).toBe(200);
  });
});
