import { beforeEach, describe, expect, it } from "vitest";
import { GET as careGet, POST as carePost } from "@/app/api/care/route";
import { GET as keeperGet, POST as keeperPost } from "@/app/api/keeper/route";
import { GET as safetyGet } from "@/app/api/safety/route";
import { ADVICE_CATEGORIES, AdviceCategoryId, adviceCategory } from "@/lib/advice";
import type { Helper } from "@/lib/kinds";
import { isDialable, MAX_NEARBY, normalizePhone, rankNearby, telHref, waHref } from "@/lib/nearby";
import { resetDemo } from "@/lib/store";
import { sessionCookie } from "./auth-helper";

const req = (url: string, member: string, body?: unknown) =>
  new Request(`http://test${url}`, { method: body === undefined ? "GET" : "POST", headers: { "content-type": "application/json", cookie: sessionCookie(member) }, body: body === undefined ? undefined : JSON.stringify(body) });
const json = async <T = Record<string, unknown>>(r: Response | Promise<Response>) => (await (await r).json()) as T;

beforeEach(() => resetDemo());

const nearbyOf = async (member: string, forMemberId: string) => rankNearby((await json<{ helpers: Helper[] }>(careGet(req("/api/care", member)))).helpers.filter((h) => h.emergency && h.forMemberId === forMemberId));

describe("trusted nearby", () => {
  it("validates and normalises phone numbers for the native dialer", () => {
    expect(isDialable("+91 98765 43210")).toBe(true);
    expect(isDialable("(020) 7946-0958")).toBe(true);
    expect(isDialable("12345")).toBe(false);
    expect(isDialable("call me")).toBe(false);
    expect(normalizePhone(" +91 (98765) 43-210 ")).toBe("+919876543210");
    expect(telHref("+91 98765 43210")).toBe("tel:+919876543210");
    expect(waHref("+91 98765 43210")).toBe("https://wa.me/919876543210");
  });

  it("caps each home at five, needs consent and a real number", async () => {
    const add = (name: string, extra: Record<string, unknown> = {}) => carePost(req("/api/care", "arjun", { action: "helper", forMemberId: "arjun", name, role: "friend", phone: "+91 90000 22222", emergency: true, consent: true, ...extra }));
    expect((await add("No consent", { consent: false })).status).toBe(400);
    expect((await add("Bad number", { phone: "12" })).status).toBe(400);
    const start = (await nearbyOf("arjun", "arjun")).length;
    for (let i = start; i < MAX_NEARBY; i++) expect((await add(`Friend ${i}`)).status).toBe(201);
    const full = await add("One too many");
    expect(full.status).toBe(409);
    expect((await json<{ error: string }>(full)).error).toBe("nearby-full");
    expect(await nearbyOf("arjun", "arjun")).toHaveLength(MAX_NEARBY);
    // A plain local helper (not on the list) is not capped.
    expect((await add("Plumber", { emergency: false, consent: false, phone: "" })).status).toBe(201);
  });

  it("reorders #1–#5 and lets you keep your own list without care.manage", async () => {
    const before = (await nearbyOf("arjun", "arjun")).map((h) => h.id);
    expect(before.length).toBeGreaterThanOrEqual(2);
    const moved = await json<{ nearby: Helper[] }>(carePost(req("/api/care", "arjun", { action: "nearby-move", helperId: before[1], dir: -1 })));
    expect(moved.nearby.map((h) => h.id).slice(0, 2)).toEqual([before[1], before[0]]);
    const after = (await nearbyOf("arjun", "arjun")).map((h) => h.id);
    expect(after.slice(0, 2)).toEqual([before[1], before[0]]);
    expect(after.slice(2)).toEqual(before.slice(2));
    // A child can't reorder someone else's list.
    expect((await carePost(req("/api/care", "aria", { action: "nearby-move", helperId: before[0], dir: 1 }))).status).toBe(403);
  });

  it("an edit keeps the consent and number rules", async () => {
    const [first] = await nearbyOf("arjun", "arjun");
    expect((await carePost(req("/api/care", "arjun", { action: "helper-edit", helperId: first.id, name: first.name, role: first.role, phone: "abc" }))).status).toBe(400);
    const ok = await json<{ helper: Helper }>(carePost(req("/api/care", "arjun", { action: "helper-edit", helperId: first.id, name: "Neha S", role: "friend", phone: "+91 90000 33333" })));
    expect(ok.helper).toMatchObject({ name: "Neha S", phone: "+919000033333", emergency: true, consent: true });
  });
});

describe("care tasks", () => {
  it("a parent adds a task; a sibling picks it up, edits it and marks it done", async () => {
    const made = await json<{ need: { id: string; status: string } }>(carePost(req("/api/care", "dadi", { action: "need", forMemberId: "dadi", title: "Book the gas cylinder" })));
    expect(made.need.status).toBe("open");
    await carePost(req("/api/care", "leo", { action: "claim", needId: made.need.id }));
    const ed = await json<{ need: { title: string; claimedBy: string } }>(carePost(req("/api/care", "leo", { action: "need-edit", needId: made.need.id, title: "Book the gas cylinder today", kind: "gas" })));
    expect(ed.need).toMatchObject({ title: "Book the gas cylinder today", claimedBy: "leo" });
    const done = await json<{ need: { status: string } }>(carePost(req("/api/care", "leo", { action: "done", needId: made.need.id })));
    expect(done.need.status).toBe("done");
  });
});

describe("advice shelves", () => {
  it("are data-driven and classify deterministically", () => {
    expect(ADVICE_CATEGORIES.map((c) => c.id)).toEqual(["life", "marriage", "children", "career", "health", "money", "home", "traditions", "blessings"]);
    expect(adviceCategory({ text: "How do I stay calm before exams?", topic: "wisdom" })).toBe("career");
    expect(adviceCategory({ text: "How did you save when money was tight?", topic: "wisdom" })).toBe("money");
    expect(adviceCategory({ text: "Will you bless me for my new job?", topic: "blessing" })).toBe("blessings");
    expect(adviceCategory({ text: "Anything at all?", topic: "wisdom" })).toBe("life");
    expect(adviceCategory({ text: "Anything at all?", topic: "wisdom", category: "home" })).toBe("home");
    expect(adviceCategory({ text: "Anything at all?", topic: "wisdom", category: "nonsense" })).toBe("life");
    expect(AdviceCategoryId.safeParse("money").success).toBe(true);
    expect(AdviceCategoryId.safeParse("tarot").success).toBe(false);
  });

  it("asking validates the shelf and every advice question comes back with one", async () => {
    expect((await keeperPost(req("/api/keeper", "priya", { action: "ask", toMemberId: "dadi", text: "How do you keep pickle fresh?", category: "tarot" }))).status).toBe(400);
    expect((await keeperPost(req("/api/keeper", "priya", { action: "ask", toMemberId: "dadi", text: "How do you keep pickle fresh?", category: "home" }))).status).toBe(201);
    const { questions } = await json<{ questions: { topic: string; category?: string }[] }>(keeperGet(req("/api/keeper", "priya")));
    const advice = questions.filter((q) => q.topic === "wisdom" || q.topic === "blessing");
    expect(advice.length).toBeGreaterThan(0);
    for (const q of advice) expect(ADVICE_CATEGORIES.some((c) => c.id === q.category)).toBe(true);
  });
});

describe("safe & sound at a glance", () => {
  it("returns per-member status and recent check-ins only to chosen people", async () => {
    type G = { members: { memberId: string; tone: string | null; label: string | null; at: string | null; etaAt: string | null; recent: { memberId: string }[] }[] };
    const arjun = await json<G>(safetyGet(req("/api/safety", "arjun")));
    const dada = arjun.members.find((m) => m.memberId === "dada");
    expect(dada).toMatchObject({ tone: "calm", label: "Home safe" });
    expect(dada?.recent.length).toBeGreaterThan(0);
    expect(dada?.recent.every((c) => c.memberId === "dada")).toBe(true);
    const leo = await json<G>(safetyGet(req("/api/safety", "leo")));
    expect(leo.members.some((m) => m.memberId === "dada")).toBe(false);
  });
});
