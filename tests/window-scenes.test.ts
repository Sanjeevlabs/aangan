import { beforeEach, describe, expect, it } from "vitest";
import { GET as windowGet, POST as windowPost } from "@/app/api/window/route";
import { clearRateLimits } from "@/lib/auth";
import { HEALTHY, POT_LOOK, bloomFrom, openFlowers, sharedToday } from "@/lib/pots";
import { POTS } from "@/lib/kinds";
import { mockClearBlobs, mockPutBlob } from "@/lib/storage";
import { resetDemo } from "@/lib/store";
import { defaultView } from "@/lib/window-server";
import { sessionCookie } from "./auth-helper";

const req = (member: string, body?: unknown) =>
  new Request("http://test/api/window", { method: body === undefined ? "GET" : "POST", headers: { "content-type": "application/json", cookie: sessionCookie(member) }, body: body === undefined ? undefined : JSON.stringify(body) });
const post = (member: string, body: unknown) => windowPost(req(member, body));
type State = { scene: string; pots: string[]; homePhoto: string | null; mixAlbum: boolean; wall: string };
const state = async (member = "arjun") => (await (await windowGet(req(member))).json()) as State;

beforeEach(() => {
  process.env.MOCK = "true";
  resetDemo();
  clearRateLimits();
  mockClearBlobs();
});

describe("first screen: scene, pots, home photo", () => {
  it("defaults: real families keep the window, no pots, the album; the demo opens on marigold and jasmine", async () => {
    const real = defaultView("some-family", "m1");
    expect(real).toMatchObject({ scene: "window", pots: [], homePhoto: null, mixAlbum: true });
    expect(await state()).toMatchObject({ scene: "window", pots: ["marigold", "jasmine"], homePhoto: null, mixAlbum: true });
  });

  it("saves a scene from the list only, per viewer", async () => {
    expect((await post("arjun", { action: "scene", scene: "balcony" })).status).toBe(200);
    expect((await state()).scene).toBe("balcony");
    expect((await state("dadi")).scene).toBe("window");
    expect((await post("arjun", { action: "scene", scene: "rooftop" })).status).toBe(400);
    expect((await post("arjun", { action: "scene" })).status).toBe(400);
    expect((await state()).scene).toBe("balcony");
  });

  it("changing the scene or the wall keeps the pots", async () => {
    await post("arjun", { action: "scene", scene: "courtyard" });
    await post("arjun", { action: "wall", wall: "lime" });
    expect(await state()).toMatchObject({ scene: "courtyard", wall: "lime", pots: ["marigold", "jasmine"] });
  });

  it("takes at most three pots, only from the set, without repeats", async () => {
    const ok = await post("arjun", { action: "pots", pots: ["rose", "succulent", "rose"] });
    expect(ok.status).toBe(200);
    expect((await state()).pots).toEqual(["rose", "succulent"]);
    expect((await post("arjun", { action: "pots", pots: ["rose", "jasmine", "geranium", "marigold"] })).status).toBe(400);
    expect((await post("arjun", { action: "pots", pots: ["cactus"] })).status).toBe(400);
    expect((await post("arjun", { action: "pots", pots: "rose" })).status).toBe(400);
    expect((await post("arjun", { action: "pots", pots: [] })).status).toBe(200);
    expect((await state()).pots).toEqual([]);
  });

  it("uses only this family's own photo as their home", async () => {
    // Another family's storage, a path that doesn't exist, another host, a traversal: all refused.
    mockPutBlob("demo-iyer/uploads/x/home.jpg", new Uint8Array([1, 2, 3]), "image/jpeg");
    for (const ref of ["storage:demo-iyer/uploads/x/home.jpg", "storage:demo-family/uploads/missing/home.jpg", "https://evil.example/p.jpg", "storage:demo-family/../demo-iyer/uploads/x/home.jpg", "/demo/not-a-card.jpg"]) {
      expect((await post("arjun", { action: "homePhoto", ref })).status).toBe(404);
    }
    expect((await state()).homePhoto).toBeNull();
    // Its own upload works.
    mockPutBlob("demo-family/uploads/abc/home.jpg", new Uint8Array([1, 2, 3]), "image/jpeg");
    expect((await post("arjun", { action: "homePhoto", ref: "storage:demo-family/uploads/abc/home.jpg" })).status).toBe(200);
    expect((await state()).homePhoto).toBe("storage:demo-family/uploads/abc/home.jpg");
    // So does the photo of one of its own cards.
    expect((await post("arjun", { action: "homePhoto", ref: "/demo/family-dadi.webp" })).status).toBe(200);
    // Mix in family photos: on by default, a toggle.
    expect((await post("arjun", { action: "homePhoto", mix: false })).status).toBe(200);
    expect(await state()).toMatchObject({ homePhoto: "/demo/family-dadi.webp", mixAlbum: false });
    // Back to the album.
    expect((await post("arjun", { action: "homePhoto", ref: null })).status).toBe(200);
    expect((await state()).homePhoto).toBeNull();
    // Nothing to change, or nonsense: refused.
    expect((await post("arjun", { action: "homePhoto" })).status).toBe(400);
    expect((await post("arjun", { action: "homePhoto", ref: "x".repeat(301) })).status).toBe(400);
    expect((await post("arjun", { action: "homePhoto", mix: "yes" })).status).toBe(400);
  });
});

describe("pots bloom with the family", () => {
  it("never falls below healthy, whatever the glow", () => {
    for (const g of [-1, 0, 0.1, Number.NaN, 0.5, 1, 2]) for (const s of [false, true]) expect(bloomFrom(g, s)).toBeGreaterThanOrEqual(HEALTHY);
    expect(bloomFrom(0, false)).toBe(HEALTHY);
    for (const pot of POTS) expect(openFlowers(pot, 0)).toBeGreaterThanOrEqual(1);
  });

  it("is monotonic in the lamp's glow and in sharing today", () => {
    let last = -1;
    for (let g = 0; g <= 1.0001; g += 0.05) {
      const b = bloomFrom(g, false);
      expect(b).toBeGreaterThanOrEqual(last);
      expect(bloomFrom(g, true)).toBeGreaterThanOrEqual(b);
      last = b;
    }
    expect(bloomFrom(1, true)).toBe(1);
    for (const pot of POTS) {
      let open = 0;
      for (let b = 0; b <= 1.0001; b += 0.05) {
        const n = openFlowers(pot, b);
        expect(n).toBeGreaterThanOrEqual(open);
        expect(n).toBeLessThanOrEqual(POT_LOOK[pot].flowers);
        open = n;
      }
      expect(open).toBe(POT_LOOK[pot].flowers);
    }
  });

  it("counts a voice or photo shared today, not an old one or a future one", () => {
    const now = new Date("2026-10-31T12:00:00");
    expect(sharedToday([{ type: "audio", takenAt: new Date("2026-10-31T08:00:00").toISOString() }], now)).toBe(true);
    expect(sharedToday([{ type: "photo", takenAt: new Date("2026-10-30T08:00:00").toISOString() }], now)).toBe(false);
    expect(sharedToday([{ type: "photo", takenAt: new Date("2026-10-31T18:00:00").toISOString() }], now)).toBe(false);
  });
});
