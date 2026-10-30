// One registry for every language a family member can read and hear the
// family in. *Content* (voice notes, captions, recipes, questions, care
// notes) is translated by Muse into each person's language; the app's own
// words come from lib/ui-strings (partial catalogues, English fallback).
// Add a language here; never branch logic on one. Codes are stored: never
// rename one.
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
  { code: "nl", name: "Dutch", native: "Nederlands", script: "Latin" },
  { code: "pl", name: "Polish", native: "Polski", script: "Latin" },
  { code: "th", name: "Thai", native: "ไทย", script: "Thai" },
  { code: "ms", name: "Malay", native: "Bahasa Melayu", script: "Latin" },
  { code: "fa", name: "Persian", native: "فارسی", script: "Arabic", rtl: true },
  { code: "he", name: "Hebrew", native: "עברית", script: "Hebrew", rtl: true },
  { code: "uk", name: "Ukrainian", native: "Українська", script: "Cyrillic" },
  { code: "el", name: "Greek", native: "Ελληνικά", script: "Greek" },
  { code: "sv", name: "Swedish", native: "Svenska", script: "Latin" },
  { code: "da", name: "Danish", native: "Dansk", script: "Latin" },
  { code: "no", name: "Norwegian", native: "Norsk", script: "Latin" },
  { code: "fi", name: "Finnish", native: "Suomi", script: "Latin" },
  { code: "cs", name: "Czech", native: "Čeština", script: "Latin" },
  { code: "ro", name: "Romanian", native: "Română", script: "Latin" },
  { code: "hu", name: "Hungarian", native: "Magyar", script: "Latin" },
  { code: "si", name: "Sinhala", native: "සිංහල", script: "Sinhala" },
  { code: "as", name: "Assamese", native: "অসমীয়া", script: "Bengali" },
  { code: "am", name: "Amharic", native: "አማርኛ", script: "Ethiopic" },
  { code: "yo", name: "Yoruba", native: "Yorùbá", script: "Latin" },
  { code: "ha", name: "Hausa", native: "Hausa", script: "Latin" },
  { code: "my", name: "Burmese", native: "မြန်မာ", script: "Myanmar" },
  { code: "km", name: "Khmer", native: "ខ្មែរ", script: "Khmer" },
  { code: "zu", name: "Zulu", native: "isiZulu", script: "Latin" },
  { code: "kk", name: "Kazakh", native: "Қазақ тілі", script: "Cyrillic" },
  { code: "ps", name: "Pashto", native: "پښتو", script: "Arabic", rtl: true },
  { code: "ig", name: "Igbo", native: "Asụsụ Igbo", script: "Latin" },
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
  // Legacy and sibling tags browsers still send.
  const ALIAS: Record<string, string> = { fil: "tl", iw: "he", in: "id", nb: "no", nn: "no", zsm: "ms", per: "fa", prs: "fa" };
  if (ALIAS[base]) return ALIAS[base] as LangCode;
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

/** True for languages written right to left (the page gets dir="rtl"). */
export function isRtl(code: string | null | undefined): boolean {
  const l = language(code);
  return Boolean("rtl" in l && l.rtl);
}

/** Model-facing description, e.g. "Tamil (ta), Tamil script". */
export function describeLang(code: string | null | undefined): string {
  const l = language(code);
  return `${l.name} (${l.code}), ${l.script} script`;
}
