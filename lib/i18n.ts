// Demo languages: English + Hindi. UI chrome stays minimal; card content
// carries the language. Add locales here, never branch logic on them.
export const SUPPORTED_LANGS = ["en", "hi"] as const;
export type SupportedLang = (typeof SUPPORTED_LANGS)[number];

const STRINGS: Record<SupportedLang, { timeline: string; empty: string }> = {
  en: { timeline: "Memory Lane — our family timeline.", empty: "No cards yet. Upload the first memory." },
  hi: { timeline: "मेमोरी लेन — हमारे परिवार की समयरेखा।", empty: "अभी कोई कार्ड नहीं। पहली याद अपलोड करें।" },
};

export function strings(lang: SupportedLang) {
  return STRINGS[lang] ?? STRINGS.en;
}
