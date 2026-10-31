import { describe, expect, it } from "vitest";
import { SCENES, livingAlbum, sceneFor, scenesFor } from "@/lib/scenes";

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
  it("only hotlinks Unsplash's CDN, and every photo says what it shows", () => {
    for (const list of Object.values(SCENES))
      for (const sc of list) {
        expect(sc.src.startsWith("https://images.unsplash.com/photo-")).toBe(true);
        expect(sc.title.length).toBeGreaterThan(8);
      }
  });
  it("the living album brings a family photo round every third slide", () => {
    const fam = [1, 2].map((n) => ({ src: `/f${n}.jpg`, title: `Family ${n}`, by: "Maa · 2025" }));
    const album = livingAlbum(SCENES.day, fam);
    expect(album).toHaveLength(SCENES.day.length + 2);
    expect(album[2]).toMatchObject({ family: true, title: "Family 1" });
    expect(album[5]).toMatchObject({ family: true, title: "Family 2" });
  });
});
