import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET as cutoutGet, POST as cutoutPost } from "@/app/api/stickers/cutout/route";
import { DELETE as shareDel, POST as sharePost } from "@/app/api/share/route";
import { serverLedger } from "@/lib/llm-server";
import { canCutOutPhoto, canMakeLampSticker, canShareOccasion, canSharePhoto, canShareQuote, canShareRecipe, canShareTodayAnswer, canShareTree } from "@/lib/share-rules";
import { getShare, resetShares } from "@/lib/shares";
import { CUTOUT_COST_USD, CUTOUT_PER_MINUTE, clearCutoutSlots, decodePhoto, mayCutOut, samMask } from "@/lib/stickers-server";
import type { Card, Member } from "@/lib/schemas";
import { resetDemo } from "@/lib/store";
import { sessionCookie } from "./auth-helper";

const who = (id: string, access: Member["access"], status: Member["status"] = "active") => ({ id, access, status });
const owner = who("arjun", "owner");
const admin = who("priya", "admin");
const member = who("dadi", "member");
const teen = who("leo", "teen");
const child = who("aria", "child");
const pending = who("new", "member", "pending");
const photoBy = (authorId: string | null) => ({ type: "photo" as const, authorId });

describe("who may share what", () => {
  it("photo print: only the person who shared it (owner and admins too, but only their own)", () => {
    expect(canSharePhoto(member, photoBy("dadi"))).toBe(true);
    expect(canSharePhoto(teen, photoBy("leo"))).toBe(true);
    expect(canSharePhoto(owner, photoBy("dadi"))).toBe(false);
    expect(canSharePhoto(admin, photoBy("dadi"))).toBe(false);
    expect(canSharePhoto(member, photoBy(null))).toBe(false);
    expect(canSharePhoto(member, { type: "audio", authorId: "dadi" })).toBe(false);
    expect(canSharePhoto(child, photoBy("aria"))).toBe(false);
    expect(canSharePhoto(pending, photoBy("new"))).toBe(false);
  });

  it("photo cut-out: own photo and a grown-up (a teen's photo may show other children)", () => {
    expect(canCutOutPhoto(member, photoBy("dadi"))).toBe(true);
    expect(canCutOutPhoto(teen, photoBy("leo"))).toBe(false);
    expect(canCutOutPhoto(owner, photoBy("dadi"))).toBe(false);
  });

  it("recipe card, link and sticker: grown-ups", () => {
    expect([owner, admin, member].every((v) => canShareRecipe(v))).toBe(true);
    expect([teen, child, pending].some((v) => canShareRecipe(v))).toBe(false);
  });

  it("occasion card: owner and admins only", () => {
    expect(canShareOccasion(owner)).toBe(true);
    expect(canShareOccasion(admin)).toBe(true);
    expect(canShareOccasion(member)).toBe(false);
    expect(canShareOccasion(teen)).toBe(false);
  });

  it("family tree poster and badge: grown-ups", () => {
    expect(canShareTree(member)).toBe(true);
    expect(canShareTree(teen)).toBe(false);
    expect(canShareTree(child)).toBe(false);
  });

  it("quote card (story, advice, blessing): who said it, or owner/admins", () => {
    expect(canShareQuote(member, "dadi")).toBe(true);
    expect(canShareQuote(owner, "dadi")).toBe(true);
    expect(canShareQuote(admin, "dadi")).toBe(true);
    expect(canShareQuote(who("kavya", "member"), "dadi")).toBe(false);
    expect(canShareQuote(teen, "dadi")).toBe(false);
    expect(canShareQuote(teen, "leo")).toBe(true);
    expect(canShareQuote(member, null)).toBe(false);
  });

  it("today's answer: your own only, not even an admin shares someone else's", () => {
    expect(canShareTodayAnswer(member, "dadi")).toBe(true);
    expect(canShareTodayAnswer(owner, "dadi")).toBe(false);
    expect(canShareTodayAnswer(admin, "dadi")).toBe(false);
  });

  it("lamp sticker: anyone in the family with a login", () => {
    expect(canMakeLampSticker(teen)).toBe(true);
    expect(canMakeLampSticker(child)).toBe(false);
    expect(canMakeLampSticker(pending)).toBe(false);
  });

  it("server-side cut-out check: own card in the same family, or an existing recipe", () => {
    const me = { ...member, familyId: "demo-family" } as unknown as Member;
    const card = { ...photoBy("dadi"), familyId: "demo-family" } as unknown as Card;
    expect(mayCutOut(me, { kind: "card", id: "x" }, { card })).toBe(true);
    expect(mayCutOut(me, { kind: "card", id: "x" }, { card: { ...card, familyId: "other" } as Card })).toBe(false);
    expect(mayCutOut(me, { kind: "card", id: "x" }, { card: null })).toBe(false);
    expect(mayCutOut(me, { kind: "recipe", id: "r" }, { recipeExists: true })).toBe(true);
    expect(mayCutOut(me, { kind: "recipe", id: "r" }, { recipeExists: false })).toBe(false);
  });
});

// A tiny valid JPEG-ish payload (the route checks the data URL shape and size, not the pixels).
const IMAGE = `data:image/jpeg;base64,${Buffer.from("not really a jpeg but bytes enough").toString("base64")}`;
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
const post = (member: string | null, body: unknown) =>
  new Request("http://test/api/stickers/cutout", { method: "POST", headers: { "content-type": "application/json", ...(member ? { cookie: sessionCookie(member) } : {}) }, body: JSON.stringify(body) });
const own = { source: { kind: "card", id: "demo-maa-morning" }, image: IMAGE, point: { x: 0.5, y: 0.4 } };

describe("sticker cut-out route", () => {
  beforeEach(() => {
    resetDemo();
    clearCutoutSlots();
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("needs a session", async () => {
    expect((await cutoutPost(post(null, own))).status).toBe(401);
    expect((await cutoutGet(new Request("http://test/api/stickers/cutout"))).status).toBe(401);
  });

  it("without SAM (mock): says so, and a cut-out request falls back to a crop", async () => {
    const g = await cutoutGet(new Request("http://test/api/stickers/cutout", { headers: { cookie: sessionCookie("dadi") } }));
    expect(await g.json()).toEqual({ available: false });
    const res = await cutoutPost(post("dadi", own));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ mask: null, fallback: "crop", reason: "no-sam" });
  });

  it("only your own photo; a recipe's dish for grown-ups; bad input is refused", async () => {
    expect((await cutoutPost(post("arjun", own))).status).toBe(403); // Maa's photo, not his
    expect((await cutoutPost(post("dadi", { ...own, source: { kind: "card", id: "nope" } }))).status).toBe(403);
    expect((await cutoutPost(post("arjun", { ...own, source: { kind: "recipe", id: "recipe-dadi-gobi" } }))).status).toBe(200);
    expect((await cutoutPost(post("aria", { ...own, source: { kind: "recipe", id: "recipe-dadi-gobi" } }))).status).toBe(403);
    expect((await cutoutPost(post("dadi", { ...own, image: "data:text/html;base64,PHNjcmlwdD4=" }))).status).toBe(400);
    expect((await cutoutPost(post("dadi", { ...own, point: { x: 2, y: 0 } }))).status).toBe(400);
  });

  it("is rate-limited per person", async () => {
    for (let i = 0; i < CUTOUT_PER_MINUTE; i++) expect((await cutoutPost(post("dadi", own))).status).toBe(200);
    expect((await cutoutPost(post("dadi", own))).status).toBe(429);
    expect((await cutoutPost(post("arjun", { ...own, source: { kind: "recipe", id: "recipe-dadi-gobi" } }))).status).toBe(200);
  });

  it("with SAM configured: forwards the photo and point with the bearer key, returns the PNG mask, counts the spend", async () => {
    vi.stubEnv("MOCK", "false");
    vi.stubEnv("META_API_KEY", "test-not-a-key");
    vi.stubEnv("SAM_URL", "https://sam.test/cutout");
    vi.stubEnv("SAM_API_KEY", "sam-test-key");
    const calls: { url: string; init: RequestInit }[] = [];
    vi.stubGlobal("fetch", async (url: string, init: RequestInit) => {
      calls.push({ url, init });
      return new Response(PNG, { headers: { "content-type": "image/png" } });
    });
    const before = serverLedger.total;
    const g = await cutoutGet(new Request("http://test/api/stickers/cutout", { headers: { cookie: sessionCookie("dadi") } }));
    expect(await g.json()).toEqual({ available: true });
    const res = await cutoutPost(post("dadi", own));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("image/png");
    expect(new Uint8Array(await res.arrayBuffer())).toEqual(PNG);
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe("https://sam.test/cutout");
    expect((calls[0].init.headers as Record<string, string>).authorization).toBe("Bearer sam-test-key");
    const sent = JSON.parse(String(calls[0].init.body));
    expect(sent.point).toEqual([0.5, 0.4]);
    expect(typeof sent.image).toBe("string");
    expect(serverLedger.total).toBeCloseTo(before + CUTOUT_COST_USD, 6);
  });

  it("SAM failures and the spend cap fall back without charging", async () => {
    vi.stubEnv("SAM_URL", "https://sam.test/cutout");
    vi.stubEnv("SAM_API_KEY", "k");
    const photo = decodePhoto(IMAGE)!;
    const before = serverLedger.total;
    expect(await samMask(photo, { x: 0.5, y: 0.5 }, (async () => new Response("{}", { status: 500 })) as typeof fetch)).toEqual({ error: "sam-failed" });
    expect(await samMask(photo, { x: 0.5, y: 0.5 }, (async () => new Response("<html>", { headers: { "content-type": "text/html" } })) as typeof fetch)).toEqual({ error: "sam-failed" });
    expect(serverLedger.total).toBe(before);
    const saved = serverLedger.total;
    serverLedger.total = 1e9;
    try {
      expect(await samMask(photo, { x: 0.5, y: 0.5 }, (async () => new Response(PNG, { headers: { "content-type": "image/png" } })) as typeof fetch)).toEqual({ error: "spend-cap" });
    } finally {
      serverLedger.total = saved;
    }
  });
});

describe("public recipe links", () => {
  beforeEach(() => {
    resetDemo();
    resetShares();
  });
  const req = (member: string, body: unknown, method = "POST") => new Request("http://test/api/share", { method, headers: { "content-type": "application/json", cookie: sessionCookie(member) }, body: JSON.stringify(body) });

  it("a teen or child can't publish; a grown-up gets a token page; whoever shared it can stop it", async () => {
    expect((await sharePost(req("aria", { kind: "recipe", id: "recipe-dadi-gobi" }))).status).toBe(403);
    const out = (await (await sharePost(req("dadi", { kind: "recipe", id: "recipe-dadi-gobi" }))).json()) as { token: string; path: string };
    expect(out.path).toMatch(/^\/r\/[A-Za-z0-9_-]{20,}$/);
    expect((await getShare(out.token))?.snapshot.title).toBe("Gobi ke pakode");
    expect((await shareDel(req("dadi", { token: out.token }, "DELETE"))).status).toBe(200);
    expect(await getShare(out.token)).toBeNull();
  });

  it("the shared recipe's Open Graph image renders (and a revoked one still answers)", async () => {
    const out = (await (await sharePost(req("arjun", { kind: "recipe", id: "recipe-dadi-gobi" }))).json()) as { token: string };
    const { default: Image, size, contentType } = await import("@/app/r/[token]/opengraph-image");
    expect(size).toEqual({ width: 1200, height: 630 });
    expect(contentType).toBe("image/png");
    const res = await Image({ params: Promise.resolve({ token: out.token }) });
    expect(res.headers.get("content-type")).toBe("image/png");
    const bytes = new Uint8Array(await res.arrayBuffer());
    expect(Array.from(bytes.slice(0, 4))).toEqual([0x89, 0x50, 0x4e, 0x47]);
    const gone = await Image({ params: Promise.resolve({ token: "x".repeat(24) }) });
    expect(gone.headers.get("content-type")).toBe("image/png");
  }, 30_000);
});
