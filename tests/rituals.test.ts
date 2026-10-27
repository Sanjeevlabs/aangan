import { describe, expect, it } from "vitest";
import { draftCards, loadRitualConfig } from "@/lib/rituals";
import diwali from "@/rituals/diwali.json";
import birthday from "@/rituals/birthday.json";

describe("ritual engine", () => {
  it("loads the Diwali config", () => {
    const cfg = loadRitualConfig(diwali);
    expect(cfg.slug).toBe("diwali");
    expect(cfg.steps.length).toBeGreaterThan(0);
  });

  it("loads the birthday config", () => {
    const cfg = loadRitualConfig(birthday);
    expect(cfg.slug).toBe("birthday");
    expect(cfg.steps.length).toBeGreaterThan(0);
  });

  it("loads any festival config without code changes", () => {
    const cfg = loadRitualConfig({
      slug: "harvest-fictional",
      title: "Fictional harvest",
      cultureNotes: "Synthetic test config.",
      steps: [{ key: "meal", kind: "photo", prompt: "Share the meal.", cardTemplate: "Meal: {caption}" }],
    });
    expect(cfg.slug).toBe("harvest-fictional");
  });

  it("rejects an invalid config", () => {
    expect(() => loadRitualConfig({ slug: "bad" })).toThrow();
  });

  it("drafts one card per completed step, in order", () => {
    const cfg = loadRitualConfig(diwali);
    const drafts = draftCards(cfg, [
      { kind: "photo", mediaId: "p1" },
      { kind: "audio", mediaId: "a1" },
    ]);
    expect(drafts.map((d) => d.stepKey)).toEqual(["light", "wish"]);
  });

  it("skips steps with no input", () => {
    const cfg = loadRitualConfig(birthday);
    const drafts = draftCards(cfg, [{ kind: "photo", mediaId: "p1" }]);
    expect(drafts.map((d) => d.stepKey)).toEqual(["cake"]);
  });
});
