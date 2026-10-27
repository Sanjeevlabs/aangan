import { describe, expect, it } from "vitest";
import {
  ASK_STARTERS,
  displayLangLabel,
  grandmaName,
  normalizeDisplayLang,
  strings,
} from "@/lib/i18n";
import { containsDevanagari, memoryStore, transcribeVoice, translateText } from "@/lib/llm";
import { dailyRoleFor, signalLineFor } from "@/lib/family";

const HAS_DEVANAGARI = /[\u0900-\u097F]/;

describe("display_lang (M2 language choice)", () => {
  it("normalizes legacy and unknown codes", () => {
    expect(normalizeDisplayLang("hi")).toBe("hi-deva");
    expect(normalizeDisplayLang("hi-latn")).toBe("hi-latn");
    expect(normalizeDisplayLang("hi-deva")).toBe("hi-deva");
    expect(normalizeDisplayLang("en")).toBe("en");
    expect(normalizeDisplayLang("fr")).toBe("en");
    expect(normalizeDisplayLang(null)).toBe("en");
    expect(normalizeDisplayLang(undefined)).toBe("en");
  });

  it("labels each option in its own script", () => {
    expect(displayLangLabel("en")).toBe("English");
    expect(displayLangLabel("hi-latn")).toBe("Hinglish");
    expect(displayLangLabel("hi-deva")).toBe("हिंदी");
  });

  it("seeds strings for all three display languages", () => {
    for (const lang of ["en", "hi-latn", "hi-deva"] as const) {
      const t = strings(lang);
      expect(t.speakToYou.length).toBeGreaterThan(0);
      expect(t.language.length).toBeGreaterThan(0);
      expect(t.welcomeTo("Leo").length).toBeGreaterThan(0);
      expect(ASK_STARTERS[lang].length).toBeGreaterThanOrEqual(3);
    }
  });

  it("hi-latn strings never contain Devanagari", () => {
    const t = strings("hi-latn");
    const samples = [
      t.tabs.home,
      t.tabs.add,
      t.greeting.morning,
      t.welcomeTo("Leo"),
      t.changeHome,
      t.stepInside,
      t.shelves.role,
      t.shelves.voices,
      t.add.title,
      t.card.untitled,
      t.viewingAs,
      t.language,
      t.speakToYou,
      ...ASK_STARTERS["hi-latn"],
    ];
    for (const s of samples) {
      expect(HAS_DEVANAGARI.test(s)).toBe(false);
    }
  });

  it("kinship names follow display_lang (Grandma / Dadi / दादी)", () => {
    expect(grandmaName("en")).toBe("Grandma");
    expect(grandmaName("hi-latn")).toBe("Dadi");
    expect(grandmaName("hi-deva")).toBe("दादी");
  });

  it("role prompts and signal lines are localized per display_lang", () => {
    expect(containsDevanagari(dailyRoleFor("hi-deva"))).toBe(true);
    expect(containsDevanagari(dailyRoleFor("hi-latn"))).toBe(false);
    expect(containsDevanagari(signalLineFor("leo", "hi-deva"))).toBe(true);
    expect(containsDevanagari(signalLineFor("leo", "hi-latn"))).toBe(false);
    expect(signalLineFor("leo", "hi-latn")).toContain("Dadi");
    expect(signalLineFor("leo", "en")).toContain("Grandma");
  });

  it("a hi-latn viewer never receives Devanagari", async () => {
    const store = memoryStore();
    const hindi = "परिवार ने मिलकर जन्मदिन का गीत गाया।";
    const { translation } = await translateText(hindi, "hi-latn", { store });
    expect(translation.language).toBe("hi-latn");
    expect(HAS_DEVANAGARI.test(translation.text)).toBe(false);
    expect(translation.text.length).toBeGreaterThan(0);
  });

  it("an en viewer never receives untranslated Hindi", async () => {
    const store = memoryStore();
    const hindi = "सुबह की दुआ — आज का दिन अच्छा हो।";
    const { translation } = await translateText(hindi, "en", { store });
    expect(translation.language).toBe("en");
    expect(HAS_DEVANAGARI.test(translation.text)).toBe(false);
    expect(translation.text.length).toBeGreaterThan(0);
  });

  it("translations cache per text + lang", async () => {
    const store = memoryStore();
    const first = await translateText("A warm family moment.", "hi-deva", { store });
    const second = await translateText("A warm family moment.", "hi-deva", { store });
    expect(first.cached).toBe(false);
    expect(second.cached).toBe(true);
    expect(second.cost).toBe(0);
    expect(second.translation.text).toBe(first.translation.text);
  });

  it("transcribe returns a schema-valid transcript", async () => {
    const { transcript } = await transcribeVoice({ audioId: "lang-test", langHint: "hi-deva" });
    expect(transcript.transcript.length).toBeGreaterThan(0);
    expect(transcript.summary.length).toBeGreaterThanOrEqual(5);
  });
});
