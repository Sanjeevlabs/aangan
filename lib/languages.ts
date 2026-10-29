// One registry for every language a family member can read and hear the
// family in. The interface itself stays English; *content* (voice notes,
// captions, recipes, questions, care notes) is translated by Muse into each
// person's language. Add a language here; never branch logic on one.
//
// "hi-latn" (Hinglish: Hindi in Latin letters) is kept as its own entry
// because many families write Hindi that way.

export interface Language {
  code: string;
  /** English name, also sent to the model so it never guesses a code. */
  name: string;
  /** How the language names itself. */
  native: string;
  script: string;
  rtl?: boolean;
}

export const LANGUAGES = [
  { code: "en", name: "English", native: "English", script: "Latin" },
  { code: "hi-deva", name: "Hindi", native: "हिंदी", script: "Devanagari" },
  { code: "hi-latn", name: "Hinglish (Hindi in Latin letters)", native: "Hinglish", script: "Latin" },
  { code: "bn", name: "Bengali", native: "বাংলা", script: "Bengali" },
  { code: "ta", name: "Tamil", native: "தமிழ்", script: "Tamil" },
  { code: "te", name: "Telugu", native: "తెలుగు", script: "Telugu" },
  { code: "mr", name: "Marathi", native: "मराठी", script: "Devanagari" },
  { code: "gu", name: "Gujarati", native: "ગુજરાતી", script: "Gujarati" },
  { code: "kn", name: "Kannada", native: "ಕನ್ನಡ", script: "Kannada" },
  { code: "ml", name: "Malayalam", native: "മലയാളം", script: "Malayalam" },
  { code: "pa", name: "Punjabi", native: "ਪੰਜਾਬੀ", script: "Gurmukhi" },
  { code: "or", name: "Odia", native: "ଓଡ଼ିଆ", script: "Odia" },
  { code: "ur", name: "Urdu", native: "اردو", script: "Arabic", rtl: true },
  { code: "ne", name: "Nepali", native: "नेपाली", script: "Devanagari" },
  { code: "es", name: "Spanish", native: "Español", script: "Latin" },
  { code: "pt", name: "Portuguese", native: "Português", script: "Latin" },
  { code: "fr", name: "French", native: "Français", script: "Latin" },
  { code: "de", name: "German", native: "Deutsch", script: "Latin" },
  { code: "it", name: "Italian", native: "Italiano", script: "Latin" },
  { code: "ar", name: "Arabic", native: "العربية", script: "Arabic", rtl: true },
  { code: "zh", name: "Chinese (Simplified)", native: "中文", script: "Han" },
  { code: "ja", name: "Japanese", native: "日本語", script: "Japanese" },
  { code: "ko", name: "Korean", native: "한국어", script: "Hangul" },
  { code: "ru", name: "Russian", native: "Русский", script: "Cyrillic" },
  { code: "tr", name: "Turkish", native: "Türkçe", script: "Latin" },
  { code: "id", name: "Indonesian", native: "Bahasa Indonesia", script: "Latin" },
  { code: "vi", name: "Vietnamese", native: "Tiếng Việt", script: "Latin" },
  { code: "tl", name: "Filipino", native: "Filipino", script: "Latin" },
  { code: "sw", name: "Swahili", native: "Kiswahili", script: "Latin" },
] as const satisfies readonly Language[];

export type LangCode = (typeof LANGUAGES)[number]["code"];
export const LANG_CODES = LANGUAGES.map((l) => l.code) as unknown as readonly [LangCode, ...LangCode[]];

const BY_CODE = new Map<string, Language>(LANGUAGES.map((l) => [l.code, l]));

/** Any incoming tag ("ta-IN", "hi", "HI-Deva", "pt_BR") → a supported code, else English. */
export function toLangCode(raw: string | null | undefined): LangCode {
  const t = (raw ?? "").trim().toLowerCase().replace("_", "-");
  if (!t) return "en";
  if (BY_CODE.has(t)) return t as LangCode;
  if (t === "hi" || t.startsWith("hi-in") || t === "hin") return "hi-deva";
  if (t === "hinglish") return "hi-latn";
  if (t.startsWith("zh")) return "zh";
  const base = t.split("-")[0];
  if (base === "fil") return "tl";
  if (BY_CODE.has(base)) return base as LangCode;
  return "en";
}

export function language(code: string | null | undefined): Language {
  return BY_CODE.get(toLangCode(code)) ?? LANGUAGES[0];
}

/** Base language without script variant: hi-deva / hi-latn → hi. */
export function baseLang(code: string | null | undefined): string {
  return toLangCode(code).split("-")[0];
}

/** Model-facing description, e.g. "Tamil (ta), Tamil script". */
export function describeLang(code: string | null | undefined): string {
  const l = language(code);
  return `${l.name} (${l.code}), ${l.script} script`;
}
