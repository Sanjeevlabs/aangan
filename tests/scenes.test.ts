import { describe, expect, it } from "vitest";
import { SCENES, sceneFor, scenesFor } from "@/lib/scenes";

describe("window scenes", () => {
  it("night and rain win over everything else", () => {
    expect(sceneFor("night", "clear")).toBe("night");
    expect(sceneFor("day", "storm")).toBe("rain");
    expect(sceneFor("night", "rain")).toBe("night");
    expect(sceneFor("dusk", "clear")).toBe("dusk");
    expect(sceneFor("day", "clouds")).toBe("clouds");
    expect(sceneFor("day", null)).toBe("day");
  });
  it("rotates the set daily and keeps every photo", () => {
    const a = scenesFor("day", "clear", new Date("2026-10-30T10:00:00Z"));
    const b = scenesFor("day", "clear", new Date("2026-10-31T10:00:00Z"));
    expect(new Set(a)).toEqual(new Set(SCENES.day));
    expect(a[0]).not.toBe(b[0]);
  });
  it("only hotlinks Unsplash's CDN", () => {
    for (const list of Object.values(SCENES)) for (const u of list) expect(u.startsWith("https://images.unsplash.com/photo-")).toBe(true);
  });
});
