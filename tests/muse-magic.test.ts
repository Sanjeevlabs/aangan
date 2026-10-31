import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST as portraitPOST } from "@/app/api/muse/portrait/route";
import { POST as keepPOST } from "@/app/api/muse/keep/route";
import { SPEND_CAP_USD } from "@/lib/config";
import { resetDocs } from "@/lib/family-docs";
import { memoryStore, SpendLedger } from "@/lib/llm";
import { buildMuseImageRequest, extractImage, museImage } from "@/lib/muse-image";
import { canInclude, canStartPortrait, checkPick, museLabel, PORTRAIT_DAILY_LIMIT, portraitPrompt, quotaLeft, RESTORE_DAILY_LIMIT } from "@/lib/muse-portrait";
import { isQuiet, pickMuseSlot, SLOT_QUIET_DAYS, thisDayCard, weekIndex } from "@/lib/muse-slot";
import { MOCK_SCAN, parseScan, scanRecipe } from "@/lib/recipe-scan";
import { CardSchema, CreateCardRequestSchema, MemberSchema, type Member, type Relationship } from "@/lib/schemas";
import { authedJson } from "./auth-helper";

const F = "fam-test";
const member = (id: string, patch: Partial<Member> = {}): Member =>
  MemberSchema.parse({ id, familyId: F, firstName: id, displayName: id, role: "adult", tz: "Asia/Kolkata", access: "member", ...patch });
const rel = (a: string, b: string, canonicalKind: Relationship["canonicalKind"]): Relationship => ({ id: `${a}-${b}`, familyId: F, memberId: a, relationMemberId: b, relation: canonicalKind, canonicalKind });

// A home in Kanpur (Maa), a home in Delhi (Arjun, Priya, their son Leo, 8) and an uncle in London.
const maa = member("maa", { role: "elder" });
const arjun = member("arjun", { access: "owner", tz: "Asia/Calcutta" });
const priya = member("priya", { tz: "Asia/Calcutta" });
const leo = member("leo", { role: "child", access: "child", tz: "Asia/Calcutta" });
const teen = member("tara", { role: "child", access: "teen", tz: "Asia/Calcutta" });
const uncle = member("rohan", { tz: "Europe/London" });
const outsider = MemberSchema.parse({ id: "stranger", familyId: "other", firstName: "S", displayName: "S", role: "adult" });
const members = [maa, arjun, priya, leo, teen, uncle];
const rels = [rel("arjun", "priya", "spouse"), rel("priya", "leo", "child"), rel("priya", "tara", "child"), rel("arjun", "maa", "parent")];

describe("family portrait: who may make one, and who may be in it", () => {
  it("only grown-ups with an account start a portrait", () => {
    expect(canStartPortrait(arjun)).toBe(true);
    expect(canStartPortrait(maa)).toBe(true);
    expect(canStartPortrait(teen)).toBe(false);
    expect(canStartPortrait(leo)).toBe(false);
    expect(canStartPortrait({ ...arjun, status: "pending" })).toBe(false);
  });

  it("a child may be included by their parent or someone in their home, not by a relative far away", () => {
    expect(canInclude(priya, leo, members, rels)).toBe(true); // parent
    expect(canInclude(arjun, leo, members, rels)).toBe(true); // same home
    expect(canInclude(uncle, leo, members, rels)).toBe(false); // London
    expect(canInclude(maa, leo, members, rels)).toBe(false); // another home
    expect(canInclude(uncle, maa, members, rels)).toBe(true); // grown-ups: anyone in the family
  });

  it("checks the whole pick: size, family, children", () => {
    expect(checkPick(arjun, ["maa", "arjun", "priya", "leo"], members, rels)).toBeNull();
    expect(checkPick(uncle, ["maa", "leo"], members, rels)).toBe("child-not-allowed");
    expect(checkPick(teen, ["maa"], members, rels)).toBe("not-allowed");
    expect(checkPick(arjun, [], members, rels)).toBe("too-few");
    expect(checkPick(arjun, ["maa", "maa"], members, rels)).toBe("duplicate");
    expect(checkPick(arjun, ["maa", "stranger"], [...members, outsider], rels)).toBe("outside-family");
    const many = Array.from({ length: 11 }, (_, i) => member(`p${i}`));
    expect(checkPick(arjun, many.map((m) => m.id), [...members, ...many], rels)).toBe("too-many");
  });

  it("asks for a painting, never a photograph, of exactly the people given", () => {
    const p = portraitPrompt("watercolour", ["Maa", "Arjun", "Leo"]);
    expect(p).toContain("exactly 3 people");
    expect(p).toContain("never like a photograph");
    expect(p).toContain("Do not add, remove or merge anyone");
  });
});

describe("daily allowance per family", () => {
  const now = new Date("2026-11-02T10:00:00Z");
  it("counts today's renders only, per kind", () => {
    const today = Array.from({ length: PORTRAIT_DAILY_LIMIT }, () => ({ kind: "portrait" as const, at: "2026-11-02T08:00:00Z" }));
    const yesterday = [{ kind: "portrait" as const, at: "2026-11-01T23:59:00Z" }];
    expect(quotaLeft([], "portrait", now)).toBe(PORTRAIT_DAILY_LIMIT);
    expect(quotaLeft(yesterday, "portrait", now)).toBe(PORTRAIT_DAILY_LIMIT);
    expect(quotaLeft(today, "portrait", now)).toBe(0);
    expect(quotaLeft(today, "restore", now)).toBe(RESTORE_DAILY_LIMIT);
  });

  it("the route refuses past the limit, and refuses a child chosen by someone far away", async () => {
    resetDocs();
    const body = { people: [{ memberId: "dadi" }, { memberId: "arjun" }], style: "oil" };
    for (let i = 0; i < PORTRAIT_DAILY_LIMIT; i++) {
      const res = await portraitPOST(authedJson("http://t/api/muse/portrait", body, "arjun"));
      expect(res.status).toBe(200);
      expect(((await res.json()) as { sample?: boolean }).sample).toBe(true); // mock: a labelled sample, no model
    }
    const over = await portraitPOST(authedJson("http://t/api/muse/portrait", body, "arjun"));
    expect(over.status).toBe(429);
    resetDocs();
    const far = await portraitPOST(authedJson("http://t/api/muse/portrait", { people: [{ memberId: "leo" }], style: "pencil" }, "rohan"));
    expect(far.status).toBe(403);
    const kid = await portraitPOST(authedJson("http://t/api/muse/portrait", body, "aria"));
    expect(kid.status).toBe(403);
  });

  it("keeps a render once, as a labelled card, and only for the person who made it", async () => {
    resetDocs();
    const made = (await (await portraitPOST(authedJson("http://t/api/muse/portrait", { people: [{ memberId: "dadi" }, { memberId: "arjun" }], style: "watercolour" }, "arjun"))).json()) as { runId: string };
    const notMine = await keepPOST(authedJson("http://t/api/muse/keep", { runId: made.runId, mediaRef: "storage:demo-family/uploads/x/muse.jpg" }, "priya"));
    expect(notMine.status).toBe(404);
    const elsewhere = await keepPOST(authedJson("http://t/api/muse/keep", { runId: made.runId, mediaRef: "https://evil.example/x.jpg" }, "arjun"));
    expect(elsewhere.status).toBe(400);
    const kept = await keepPOST(authedJson("http://t/api/muse/keep", { runId: made.runId, mediaRef: "storage:demo-family/uploads/x/muse.jpg" }, "arjun"));
    expect(kept.status).toBe(201);
    const { card } = (await kept.json()) as { card: { source: string } };
    expect(card.source).toBe("muse-portrait");
    expect(museLabel(card.source)).toBe("Painted by Muse");
    const again = await keepPOST(authedJson("http://t/api/muse/keep", { runId: made.runId, mediaRef: "storage:demo-family/uploads/x/muse.jpg" }, "arjun"));
    expect(again.status).toBe(409);
  });

  it("a plain upload can never claim to be made by Muse (or hide that it was)", () => {
    expect(CreateCardRequestSchema.safeParse({ type: "photo", takenAt: new Date().toISOString(), source: "muse-portrait" }).success).toBe(false);
    expect(CardSchema.shape.source.safeParse("muse-restored").success).toBe(true);
  });
});

describe("Muse Image: the real request shape, and the spend cap", () => {
  const env = { ...process.env };
  beforeEach(() => {
    process.env.MOCK = "false";
    process.env.META_API_KEY = ["fake", "key"].join("-");
  });
  afterEach(() => {
    process.env = { ...env };
  });

  it("builds a Responses API turn with the photos as input_image parts in a user message", () => {
    const body = buildMuseImageRequest("paint", ["data:image/jpeg;base64,AAAA", "data:image/jpeg;base64,BBBB"], "1536x1024");
    expect(body.model).toBe("muse-image-1.0");
    expect(body.input[0].role).toBe("user");
    expect(body.input[0].content.map((c) => c.type)).toEqual(["input_text", "input_image", "input_image"]);
    expect(body.tools).toEqual([{ type: "image_generation", size: "1536x1024" }]);
    expect(body.store).toBe(false);
    expect(extractImage({ output: [{ type: "reasoning" }, { type: "image_generation_call", result: "A".repeat(200) }] })).toBe("A".repeat(200));
    expect(extractImage({ output: [{ type: "message" }] })).toBeNull();
  });

  it("refuses past the cap without calling Muse", async () => {
    const store = memoryStore();
    const ledger = new SpendLedger(store);
    await ledger.commit(SPEND_CAP_USD - 0.01);
    const fetcher = vi.fn();
    const out = await museImage({ familyId: F, purpose: "test", prompt: "paint", images: ["data:image/jpeg;base64,AAAA"], ledger, store, fetcher });
    expect(out.status).toBe("refused");
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("records the cost of a render and caches it; Try again is a new render", async () => {
    const store = memoryStore();
    const ledger = new SpendLedger(store);
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, ...new Array(200).fill(1)]).toString("base64");
    const fetcher = vi.fn(async () => new Response(JSON.stringify({ output: [{ type: "image_generation_call", result: png }] }), { status: 200 }));
    const args = { familyId: F, purpose: "test", prompt: "paint", images: ["data:image/jpeg;base64,AAAA"], ledger, store, fetcher };
    const first = await museImage(args);
    expect(first.status).toBe("ok");
    expect(first.status === "ok" && first.image.startsWith("data:image/png;base64,")).toBe(true);
    expect(ledger.total).toBeGreaterThan(0);
    const cached = await museImage(args);
    expect(cached.status === "ok" && cached.cached).toBe(true);
    await museImage({ ...args, variant: 1 });
    expect(fetcher).toHaveBeenCalledTimes(2);
    const [url, init] = fetcher.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.meta.ai/v1/responses");
    expect(JSON.parse(String(init.body)).input[0].content[1]).toEqual({ type: "input_image", image_url: "data:image/jpeg;base64,AAAA" });
  });

  it("is a sample (no call at all) when Muse is off", async () => {
    process.env.MOCK = "true";
    const fetcher = vi.fn();
    const out = await museImage({ familyId: F, purpose: "test", prompt: "p", images: ["data:image/jpeg;base64,AAAA"], fetcher });
    expect(out.status).toBe("sample");
    expect(fetcher).not.toHaveBeenCalled();
  });
});

describe("reading a recipe card", () => {
  const image = { bytes: new Uint8Array([1, 2, 3, 4]), mime: "image/jpeg" };

  it("validates against the Kitchen's recipe shape", () => {
    expect(parseScan(MOCK_SCAN)).not.toBeNull();
    expect(parseScan({ title: "", ingredients: [], steps: [] })).toBeNull();
    expect(parseScan({ title: "Dal", ingredients: [{ item: "dal" }], steps: [] })).toBeNull();
    expect(parseScan({ title: "Dal", course: "dessert-ish", ingredients: [{ item: "dal" }], steps: [{ text: "boil" }] })).toBeNull();
    expect(parseScan({ title: "Dal", ingredients: [{ item: "dal" }], steps: [{ text: "boil" }] })?.course).toBe("main");
  });

  it("retries once, then falls back to an empty editor", async () => {
    const bad = vi.fn(async () => ({ json: { nonsense: true }, cost: 0.01 }));
    const out = await scanRecipe({ familyId: F, image, ledger: new SpendLedger(memoryStore()), store: memoryStore(), call: bad, forceLive: true });
    expect(out).toEqual({ draft: null, source: "fallback" });
    expect(bad).toHaveBeenCalledTimes(2);

    let n = 0;
    const second = vi.fn(async () => ({ json: n++ === 0 ? "garbage" : MOCK_SCAN, cost: 0.01 }));
    const ok = await scanRecipe({ familyId: F, image, ledger: new SpendLedger(memoryStore()), store: memoryStore(), call: second, forceLive: true });
    expect(ok.source).toBe("muse");
    expect(ok.draft?.title).toBe("Besan ladoo");
  });

  it("falls back without a call past the spend cap", async () => {
    const ledger = new SpendLedger(memoryStore());
    await ledger.commit(SPEND_CAP_USD);
    const call = vi.fn();
    const out = await scanRecipe({ familyId: F, image, ledger, store: memoryStore(), call, forceLive: true });
    expect(out.source).toBe("fallback");
    expect(call).not.toHaveBeenCalled();
  });

  it("gives the fixed synthetic card in mock mode", async () => {
    expect((await scanRecipe({ familyId: F, image })).draft?.title).toBe(MOCK_SCAN.title);
  });
});

describe("Muse made this for you (one card, weekly, dismissible)", () => {
  const now = new Date("2026-11-02T10:00:00Z");
  const photo = (takenAt: string) => CardSchema.parse({ id: takenAt, familyId: F, type: "photo", caption: "Dadi's garden", lang: "en", takenAt });

  it("a dismissal hides it for two weeks, then it may come back", () => {
    const base = { now, canPortrait: true, portraitPeople: 4, cards: [] };
    expect(pickMuseSlot({ ...base, dismissedAt: new Date(now.getTime() - 3 * 86_400_000).toISOString() })).toBeNull();
    expect(pickMuseSlot({ ...base, dismissedAt: new Date(now.getTime() - (SLOT_QUIET_DAYS + 1) * 86_400_000).toISOString() })).toEqual({ kind: "portrait" });
    expect(isQuiet(null, now)).toBe(false);
  });

  it("offers nothing to someone who can't act on it", () => {
    expect(pickMuseSlot({ now, dismissedAt: null, canPortrait: false, portraitPeople: 4, cards: [] })).toBeNull();
    expect(pickMuseSlot({ now, dismissedAt: null, canPortrait: true, portraitPeople: 1, cards: [] })).toBeNull();
  });

  it("rotates weekly between real offers; 'this day' needs a photo from this date", () => {
    const cards = [photo("2023-11-02T09:00:00Z"), photo("2024-06-01T09:00:00Z")];
    expect(thisDayCard(cards, now)?.years).toBe(3);
    const week = (w: number) => new Date(now.getTime() + (w - weekIndex(now)) * 7 * 86_400_000);
    const kinds = [0, 1].map((k) => pickMuseSlot({ now: week(weekIndex(now) + k), dismissedAt: null, canPortrait: true, portraitPeople: 3, cards: [photo(`${2023}-${String(week(weekIndex(now) + k).getMonth() + 1).padStart(2, "0")}-${String(week(weekIndex(now) + k).getDate()).padStart(2, "0")}T09:00:00Z`)] })?.kind);
    expect(new Set(kinds)).toEqual(new Set(["portrait", "this-day"]));
  });
});
