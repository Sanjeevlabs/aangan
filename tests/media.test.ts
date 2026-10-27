import { describe, expect, it } from "vitest";
import { daysUntilBirthday } from "@/lib/family";
import { greetingForHour } from "@/lib/i18n";
import {
  dominantColors,
  isGlassesCapture,
  peaksFromSamples,
  resolveHomeImage,
  resolveSource,
} from "@/lib/media";

describe("glasses detection (EXIF Make/Model)", () => {
  it("flags Meta, Ray-Ban, and Oakley captures", () => {
    expect(isGlassesCapture("Meta", "Skyler")).toBe(true);
    expect(isGlassesCapture("Meta Platforms", null)).toBe(true);
    expect(isGlassesCapture(null, "Ray-Ban Meta")).toBe(true);
    expect(isGlassesCapture("rayban", null)).toBe(true);
    expect(isGlassesCapture("Oakley", "Meta HSTN")).toBe(true);
  });

  it("rejects ordinary cameras and near-miss maker names", () => {
    expect(isGlassesCapture("Apple", "iPhone 15")).toBe(false);
    expect(isGlassesCapture("samsung", "SM-S921")).toBe(false);
    expect(isGlassesCapture("Metax", null)).toBe(false);
    expect(isGlassesCapture(null, null)).toBe(false);
    expect(isGlassesCapture(undefined, undefined)).toBe(false);
  });
});

describe("card source resolution", () => {
  it("prefers glasses evidence, then today pool, then plain upload", () => {
    expect(resolveSource({ fromGlassesToggle: true, fromToday: true })).toBe("glasses");
    expect(resolveSource({ fromGlassesToggle: false, exifMake: "Meta", fromToday: true })).toBe("glasses");
    expect(resolveSource({ fromGlassesToggle: false, fromToday: true })).toBe("today");
    expect(resolveSource({ fromGlassesToggle: false, fromToday: false })).toBe("upload");
  });
});

describe("waveform peaks", () => {
  it("takes max absolute amplitude per bucket", () => {
    expect(peaksFromSamples([0.5, -0.5, 1, -1], 2)).toEqual([0.5, 1]);
  });

  it("handles empty input and degenerate buckets", () => {
    expect(peaksFromSamples([], 4)).toEqual([0, 0, 0, 0]);
    expect(peaksFromSamples([0.5], 0)).toEqual([]);
  });
});

describe("dominant colors", () => {
  it("ranks the most frequent bucket first", () => {
    const red = [255, 0, 0, 255];
    const blue = [0, 0, 255, 255];
    const pixels = [...red, ...red, ...red, ...red, ...blue, ...blue];
    const [first] = dominantColors(pixels, 3);
    expect(first).toBe("#ff0000");
  });

  it("prefers colorful buckets over gray for wash seeding", () => {
    const gray = [128, 128, 128, 255];
    const red = [255, 0, 0, 255];
    const pixels = [...Array(10).fill(gray).flat(), ...Array(6).fill(red).flat()];
    expect(dominantColors(pixels, 2)[0]).toBe("#ff0000");
  });

  it("is deterministic", () => {
    const pixels = [10, 200, 90, 255, 200, 90, 10, 255, 10, 200, 90, 255];
    expect(dominantColors(pixels, 2)).toEqual(dominantColors(pixels, 2));
  });
});

describe("home image precedence", () => {
  it("prefers member photo, then family default, then fallback art", () => {
    expect(resolveHomeImage("m1", "f1")).toBe("m1");
    expect(resolveHomeImage(null, "f1")).toBe("f1");
    expect(resolveHomeImage(undefined, undefined)).toBeNull();
  });
});

describe("greeting day parts", () => {
  it("splits the day at noon and 5pm", () => {
    expect(greetingForHour(9)).toBe("morning");
    expect(greetingForHour(12)).toBe("afternoon");
    expect(greetingForHour(16)).toBe("afternoon");
    expect(greetingForHour(17)).toBe("evening");
    expect(greetingForHour(22)).toBe("evening");
  });
});

describe("birthday countdown", () => {
  const now = new Date("2026-10-27T12:00:00.000Z");

  it("counts forward within the year, zero on the day, wraps past birthdays", () => {
    expect(daysUntilBirthday("11-09", now)).toBe(13);
    expect(daysUntilBirthday("10-27", now)).toBe(0);
    expect(daysUntilBirthday("10-26", now)).toBe(364);
  });
});
