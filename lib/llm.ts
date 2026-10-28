import { createHash } from "crypto";
import { z } from "zod";
import { activeProvider, isMockMode, PROVIDERS, SPEND_CAP_USD } from "./config";
import {
  CaptionSchema,
  TranslationSchema,
  VoiceTranscriptSchema,
  type Caption,
  type Translation,
  type VoiceTranscript,
} from "./schemas";
import { normalizeDisplayLang } from "./i18n";

export interface LlmStore {
  get(key: string): string | undefined;
  set(key: string, value: string): void;
}

export function memoryStore(): LlmStore {
  const map = new Map<string, string>();
  return {
    get: (key) => map.get(key),
    set: (key, value) => map.set(key, value),
  };
}

// Spend ledger: cumulative USD across calls. Refuses calls past the cap.
export class SpendLedger {
  total = 0;
  constructor(private store: LlmStore) {
    const raw = store.get("spend:total");
    if (raw) this.total = Number(raw) || 0;
  }
  canSpend(cost: number): boolean {
    return this.total + cost <= SPEND_CAP_USD;
  }
  record(cost: number): void {
    this.total += cost;
    this.store.set("spend:total", String(this.total));
  }
}

export function cacheKey(model: string, input: string, mediaId: string): string {
  return createHash("sha256").update(`${model}|${input}|${mediaId}`).digest("hex");
}

const FALLBACK_CAPTION: Caption = {
  caption: "A family memory, saved to Memory Lane.",
  language: "en",
  names: [],
  takenAt: null,
};

async function mockCaption(prompt: string): Promise<{ json: unknown; cost: number }> {
  const hindi = /hindi|\bhi\b/i.test(prompt);
  return {
    json: hindi
      ? {
          caption: "परिवार की एक प्यारी याद।",
          language: "hi",
          names: [],
          takenAt: null,
        }
      : {
          caption: "A warm family moment, kept close.",
          language: "en",
          names: [],
          takenAt: null,
        },
    cost: 0,
  };
}

async function liveCaption(
  provider: keyof typeof PROVIDERS,
  systemPrompt: string,
  userPrompt: string,
): Promise<{ json: unknown; cost: number }> {
  const cfg = PROVIDERS[provider];
  const key = process.env.META_API_KEY;
  if (!key) throw new Error("missing-key");
  const res = await fetch(`${cfg.baseUrl}/chat/completions`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: cfg.captionModel,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      response_format: { type: "json_object" },
      // Reasoning models spend hundreds of tokens before answering; a low
      // cap truncates the reply to null and trips the fallback every time.
      max_tokens: 2000,
    }),
  });
  if (!res.ok) throw new Error(`provider-${res.status}`);
  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const text = data.choices?.[0]?.message?.content ?? "{}";
  return { json: JSON.parse(text) as unknown, cost: 0.01 };
}

const CAPTION_SYSTEM =
  "Write a short family-memory caption as JSON: {caption, language, names, takenAt}. " +
  "Caption is 10-280 chars. Names must only repeat names given in the prompt. " +
  "takenAt is ISO datetime or null when unknown. Reply with JSON only.";

// One retry on invalid schema, then a safe fallback card. Never throws.
export async function captionCard(
  prompt: string,
  opts: { mediaId?: string; store?: LlmStore; ledger?: SpendLedger } = {},
): Promise<{ caption: Caption; cached: boolean; cost: number }> {
  const mediaId = opts.mediaId ?? "unknown";
  const store = opts.store ?? memoryStore();
  const ledger = opts.ledger ?? new SpendLedger(store);
  const provider = activeProvider();
  const model = PROVIDERS[provider].captionModel;
  const key = `llm:${cacheKey(model, prompt, mediaId)}`;
  const hit = store.get(key);
  if (hit) {
    const parsed = CaptionSchema.safeParse(JSON.parse(hit));
    if (parsed.success) return { caption: parsed.data, cached: true, cost: 0 };
  }

  const estimatedCost = isMockMode() ? 0 : 0.01;
  if (!ledger.canSpend(estimatedCost)) {
    return { caption: FALLBACK_CAPTION, cached: false, cost: 0 };
  }

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const out = isMockMode()
        ? await mockCaption(prompt)
        : await liveCaption(provider, CAPTION_SYSTEM, prompt).catch(async (err) => {
            // Provider fallback: Baseten only when credits confirmed, else rethrow.
            if (provider === "meta" && process.env.BASETEN_CREDITS_CONFIRMED === "1") {
              return liveCaption("baseten", CAPTION_SYSTEM, prompt);
            }
            throw err;
          });
      const parsed = CaptionSchema.safeParse(out.json);
      if (!parsed.success) continue;
      parsed.data.language = normalizeLangCode(parsed.data.language, "en");
      ledger.record(out.cost);
      store.set(key, JSON.stringify(parsed.data));
      return { caption: parsed.data, cached: false, cost: out.cost };
    } catch {
      continue;
    }
  }
  return { caption: FALLBACK_CAPTION, cached: false, cost: 0 };
}

const FALLBACK_TRANSCRIPT: VoiceTranscript = {
  transcript: "A short voice note.",
  summary: "Voice note saved to Memory Lane.",
  language: "en",
  segments: [],
};

const FALLBACK_TRANSLATION: Translation = {
  text: "A family memory, kept close.",
  language: "en",
};

const KNOWN_EN_TO_HI_DEVA: Array<[RegExp, string]> = [
  [/birthday song/i, "परिवार ने मिलकर जन्मदिन का गीत गाया।"],
  [/courtyard game/i, "आँगन का खेल, पूरे जोश में सुनाया।"],
  [/morning blessing|morning prayer/i, "सुबह की दुआ — आज का दिन अच्छा हो।"],
  [/lullaby/i, "एक मीठी लोरी।"],
];

const KNOWN_EN_TO_LATN: Array<[RegExp, string]> = [
  [/birthday song/i, "Parivaar ne milkar janmadin ka geet gaya."],
  [/courtyard game/i, "Aangan ka khel, poore josh mein sunaya."],
  [/morning blessing|morning prayer/i, "Subah ki dua — aaj ka din achha ho."],
  [/lullaby/i, "Ek meethi lori."],
  [/warm family moment|family memory/i, "Parivaar ki ek pyaari yaad."],
];

const KNOWN_HI_TO_EN: Array<[RegExp, string]> = [
  [/जन्मदिन का गीत/, "The family sang a birthday song together."],
  [/आँगन में धूप/, "Sunshine and tea in the courtyard."],
  [/सुबह की दुआ/, "A morning blessing for a good day."],
  [/नया शब्द/, "Aria shared a new word."],
  [/पुराना दरवाज़ा|पुरानी/i, "An old doorway in winter light."],
];

const KNOWN_HI_TO_LATN: Array<[RegExp, string]> = [
  [/जन्मदिन का गीत/, "Parivaar ne milkar janmadin ka geet gaya."],
  [/आँगन में धूप/, "Aangan mein dhoop aur chai."],
  [/सुबह की दुआ/, "Subah ki dua — aaj ka din achha ho."],
  [/नया शब्द/, "Aria ne naya shabd sunaya."],
  [/परिवार की एक प्यारी याद/, "Parivaar ki ek pyaari yaad."],
];

export function containsDevanagari(s: string): boolean {
  return /[\u0900-\u097F]/.test(s);
}

// Model language codes vary ("Hindi", "HI", "hindi (devanagari)"): normalize
// to the short codes the display layer routes on. Unknown codes fall back
// to the caller's fallback so nothing unparseable reaches the UI.
export function normalizeLangCode(raw: unknown, fallback: string): string {
  const l = String(raw ?? "").trim().toLowerCase();
  if (l.startsWith("hi-latn") || l === "hinglish") return "hi-latn";
  if (l.startsWith("hi-deva") || l.includes("devanagari")) return "hi-deva";
  if (l.startsWith("hi")) return "hi";
  if (l.startsWith("en")) return "en";
  return fallback;
}

async function mockTranscribe(audioId: string, langHint: string): Promise<{ json: unknown; cost: number }> {
  const lang = normalizeDisplayLang(langHint);
  // hi-latn speakers speak Hindi: transcribe the Hindi source, the display
  // layer transliterates it to Latin script per card + lang.
  if (lang === "hi-deva" || lang === "hi-latn") {
    return {
      json: {
        transcript: "सुबह की दुआ — आज का दिन अच्छा हो। भगवान तुम्हें खुश रखे।",
        summary: "सुबह की दुआ।",
        language: "hi",
        segments: [
          { start: 0, end: 4, text: "सुबह की दुआ — आज का दिन अच्छा हो।" },
          { start: 4, end: 8, text: "भगवान तुम्हें खुश रखे।" },
        ],
      },
      cost: 0,
    };
  }
  void audioId;
  return {
    json: {
      transcript: "Good morning, my love. Have a wonderful day. God bless your exam.",
      summary: "A morning blessing.",
      language: "en",
      segments: [
        { start: 0, end: 4, text: "Good morning, my love." },
        { start: 4, end: 8, text: "Have a wonderful day." },
        { start: 8, end: 12, text: "God bless your exam." },
      ],
    },
    cost: 0,
  };
}

async function mockTranslate(text: string, targetLang: string): Promise<{ json: unknown; cost: number }> {
  const target = normalizeDisplayLang(targetLang);
  if (target === "hi-deva") {
    for (const [re, hi] of KNOWN_EN_TO_HI_DEVA) {
      if (re.test(text)) return { json: { text: hi, language: "hi-deva" }, cost: 0 };
    }
    if (containsDevanagari(text)) return { json: { text, language: "hi-deva" }, cost: 0 };
    return { json: { text: "परिवार की एक प्यारी याद।", language: "hi-deva" }, cost: 0 };
  }
  if (target === "hi-latn") {
    for (const [re, latn] of KNOWN_HI_TO_LATN) {
      if (re.test(text)) return { json: { text: latn, language: "hi-latn" }, cost: 0 };
    }
    for (const [re, latn] of KNOWN_EN_TO_LATN) {
      if (re.test(text)) return { json: { text: latn, language: "hi-latn" }, cost: 0 };
    }
    if (!containsDevanagari(text)) return { json: { text, language: "hi-latn" }, cost: 0 };
    return { json: { text: "Parivaar ki ek pyaari yaad.", language: "hi-latn" }, cost: 0 };
  }
  for (const [re, en] of KNOWN_HI_TO_EN) {
    if (re.test(text)) return { json: { text: en, language: "en" }, cost: 0 };
  }
  if (!containsDevanagari(text)) return { json: { text, language: "en" }, cost: 0 };
  return { json: { text: "A family memory, kept close.", language: "en" }, cost: 0 };
}

const TRANSCRIPT_SYSTEM =
  "Transcribe the described family voice note as JSON: {transcript, summary, language, segments}. " +
  "transcript is the full text, summary is 5-500 chars, language is a short code, " +
  "segments is an array of {start, end, text} in seconds. Reply with JSON only.";

const TRANSLATE_SYSTEM =
  "Translate the given family text as JSON: {text, language}. " +
  "text is the translation in the requested target language, language is its short code. " +
  "Translate, never explain. Reply with JSON only.";

async function liveJson(
  provider: keyof typeof PROVIDERS,
  system: string,
  user: string,
  model: string,
  maxTokens = 500,
): Promise<{ json: unknown; cost: number }> {
  const cfg = PROVIDERS[provider];
  const key = process.env.META_API_KEY;
  if (!key) throw new Error("missing-key");
  const res = await fetch(`${cfg.baseUrl}/chat/completions`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      response_format: { type: "json_object" },
      max_tokens: maxTokens,
    }),
  });
  if (!res.ok) throw new Error(`provider-${res.status}`);
  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const raw = data.choices?.[0]?.message?.content ?? "{}";
  return { json: JSON.parse(raw) as unknown, cost: 0.01 };
}

// Voice transcription: mock-first; live uses the chat endpoint with a
// description (raw audio upload wiring lands with Supabase storage).
export async function transcribeVoice(
  input: { audioId?: string; langHint?: string },
  opts: { store?: LlmStore; ledger?: SpendLedger } = {},
): Promise<{ transcript: VoiceTranscript; cached: boolean; cost: number }> {
  const audioId = input.audioId ?? "voice";
  const langHint = normalizeDisplayLang(input.langHint ?? "en");
  const store = opts.store ?? memoryStore();
  const ledger = opts.ledger ?? new SpendLedger(store);
  const provider = activeProvider();
  const model = PROVIDERS[provider].transcribeModel;
  const key = `llm:${cacheKey(model, `transcribe:${langHint}`, audioId)}`;
  const hit = store.get(key);
  if (hit) {
    const parsed = VoiceTranscriptSchema.safeParse(JSON.parse(hit));
    if (parsed.success) return { transcript: parsed.data, cached: true, cost: 0 };
  }
  const estimatedCost = isMockMode() ? 0 : 0.01;
  if (!ledger.canSpend(estimatedCost)) {
    return { transcript: FALLBACK_TRANSCRIPT, cached: false, cost: 0 };
  }
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const out = isMockMode()
        ? await mockTranscribe(audioId, langHint)
        : await liveJson(
            provider,
            TRANSCRIPT_SYSTEM,
            `Voice note ${audioId}, reply in ${langHint}.`,
            model,
            2000,
          );
      const parsed = VoiceTranscriptSchema.safeParse(out.json);
      if (!parsed.success) continue;
      parsed.data.language = normalizeLangCode(parsed.data.language, "en");
      ledger.record(out.cost);
      store.set(key, JSON.stringify(parsed.data));
      return { transcript: parsed.data, cached: false, cost: out.cost };
    } catch {
      continue;
    }
  }
  return { transcript: FALLBACK_TRANSCRIPT, cached: false, cost: 0 };
}

const SuggestSchema = z.object({ questions: z.array(z.string().min(5).max(200)).min(1).max(5) });

const PlaylistSchema = z.object({
  tracks: z.array(z.object({ cardId: z.string(), note: z.string().max(120) })).min(1).max(8),
});

const PLAYLIST_SYSTEM =
  "Curate a warm family-evening playlist as JSON: {tracks: [{cardId, note}]}. " +
  "Pick from the given card ids only, warmest first, at most 8. " +
  "Each note is one short line about why this track fits the evening. Reply with JSON only.";

const MOCK_SUGGESTIONS: Record<string, string[]> = {
  en: [
    "What did your courtyard smell like in the morning?",
    "Which festival food should the children learn first?",
    "What blessing do you want to record for Leo's exam?",
  ],
  "hi-latn": [
    "Subah aapka aangan kaisa mehakta tha?",
    "Bachchon ko sabse pehle kaun-sa tyohaar ka khana seekhna chahiye?",
    "Leo ke exam ke liye kaun-sa aashirvaad record karna chahengi?",
  ],
  "hi-deva": [
    "सुबह आपका आँगन कैसा महकता था?",
    "बच्चों को सबसे पहले कौन-सा त्योहार का खाना सीखना चाहिए?",
    "लियो की परीक्षा के लिए कौन-सा आशीर्वाद रिकॉर्ड करना चाहेंगी?",
  ],
};

const SUGGEST_SYSTEM =
  "Suggest family questions as JSON: {questions}. Three short warm questions " +
  "an elder would love to answer by voice, in the requested language. " +
  "Reply with JSON only.";

async function mockSuggest(displayLang: string): Promise<{ json: unknown; cost: number }> {
  const lang = normalizeDisplayLang(displayLang);
  return { json: { questions: MOCK_SUGGESTIONS[lang] ?? MOCK_SUGGESTIONS.en }, cost: 0 };
}

// Elder-question suggestions via muse-spark-1.3, cached per member + lang.
// Mock returns localized starters; live calls the model once per lang.
export async function suggestQuestions(
  input: { memberId?: string; displayLang?: string },
  opts: { store?: LlmStore; ledger?: SpendLedger } = {},
): Promise<{ questions: string[]; cached: boolean; cost: number }> {
  const memberId = input.memberId ?? "elder";
  const lang = normalizeDisplayLang(input.displayLang ?? "en");
  const store = opts.store ?? memoryStore();
  const ledger = opts.ledger ?? new SpendLedger(store);
  const provider = activeProvider();
  const model = PROVIDERS[provider].captionModel;
  const key = `llm:${cacheKey(model, `suggest:${lang}`, memberId)}`;
  const hit = store.get(key);
  if (hit) {
    const parsed = SuggestSchema.safeParse(JSON.parse(hit));
    if (parsed.success) return { questions: parsed.data.questions, cached: true, cost: 0 };
  }
  const estimatedCost = isMockMode() ? 0 : 0.01;
  if (!ledger.canSpend(estimatedCost)) {
    return { questions: MOCK_SUGGESTIONS[lang] ?? MOCK_SUGGESTIONS.en, cached: false, cost: 0 };
  }
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const out = isMockMode()
        ? await mockSuggest(lang)
        : await liveJson(
            provider,
            SUGGEST_SYSTEM,
            `Elder questions for ${memberId} in ${lang}.`,
            model,
            2000,
          );
      const parsed = SuggestSchema.safeParse(out.json);
      if (!parsed.success) continue;
      ledger.record(out.cost);
      store.set(key, JSON.stringify(parsed.data));
      return { questions: parsed.data.questions, cached: false, cost: out.cost };
    } catch {
      continue;
    }
  }
  return { questions: MOCK_SUGGESTIONS[lang] ?? MOCK_SUGGESTIONS.en, cached: false, cost: 0 };
}

// Gather playlist curation from the Lane (muse-spark-1.3, structured
// output, one retry then fallback). Mock picks the newest audio first.
export async function curatePlaylist(
  cards: { id: string; caption: string }[],
  opts: { store?: LlmStore; ledger?: SpendLedger } = {},
): Promise<{ tracks: { cardId: string; note: string }[]; cached: boolean; cost: number }> {
  const store = opts.store ?? memoryStore();
  const ledger = opts.ledger ?? new SpendLedger(store);
  const provider = activeProvider();
  const model = PROVIDERS[provider].captionModel;
  const ids = cards.map((c) => c.id).join(",");
  const key = `llm:${cacheKey(model, `playlist:${ids}`, "gather")}`;
  const hit = store.get(key);
  if (hit) {
    const parsed = PlaylistSchema.safeParse(JSON.parse(hit));
    if (parsed.success) return { tracks: parsed.data.tracks, cached: true, cost: 0 };
  }
  const estimatedCost = isMockMode() ? 0 : 0.01;
  if (!ledger.canSpend(estimatedCost) || cards.length === 0) {
    return { tracks: [], cached: false, cost: 0 };
  }
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const out = isMockMode()
        ? {
            json: {
              tracks: cards.slice(0, 5).map((c, i) => ({ cardId: c.id, note: i === 0 ? "Open the evening together" : "Keep the warmth going" })),
            },
            cost: 0,
          }
        : await liveJson(
            provider,
            PLAYLIST_SYSTEM,
            `Cards:\n${cards.slice(0, 20).map((c) => `- ${c.id}: ${c.caption.slice(0, 120)}`).join("\n")}`,
            model,
          );
      const parsed = PlaylistSchema.safeParse(out.json);
      if (!parsed.success) continue;
      // Never invent: drop tracks pointing at unknown cards.
      const known = new Set(cards.map((c) => c.id));
      const tracks = parsed.data.tracks.filter((t) => known.has(t.cardId));
      if (tracks.length === 0) continue;
      ledger.record(out.cost);
      store.set(key, JSON.stringify({ tracks }));
      return { tracks, cached: false, cost: out.cost };
    } catch {
      continue;
    }
  }
  return { tracks: [], cached: false, cost: 0 };
}

// Translation/transliteration into the viewer's display_lang, cached per
// card text + lang. Mock never leaks script: en output is Latin-only with
// no untranslated Hindi, hi-latn output is Latin-only, hi-deva Devanagari.
export async function translateText(
  text: string,
  targetLang: string,
  opts: { store?: LlmStore; ledger?: SpendLedger } = {},
): Promise<{ translation: Translation; cached: boolean; cost: number }> {
  const target = normalizeDisplayLang(targetLang);
  const store = opts.store ?? memoryStore();
  const ledger = opts.ledger ?? new SpendLedger(store);
  const provider = activeProvider();
  const model = PROVIDERS[provider].captionModel;
  const key = `llm:${cacheKey(model, `translate:${target}:${text}`, "text")}`;
  const hit = store.get(key);
  if (hit) {
    const parsed = TranslationSchema.safeParse(JSON.parse(hit));
    if (parsed.success) return { translation: parsed.data, cached: true, cost: 0 };
  }
  const estimatedCost = isMockMode() ? 0 : 0.01;
  if (!ledger.canSpend(estimatedCost)) {
    return { translation: { ...FALLBACK_TRANSLATION, language: target }, cached: false, cost: 0 };
  }
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const out = isMockMode()
        ? await mockTranslate(text, target)
        : await liveJson(provider, TRANSLATE_SYSTEM, `Target language: ${target}\nText:\n${text}`, model, 1500);
      const parsed = TranslationSchema.safeParse(out.json);
      if (!parsed.success) continue;
      parsed.data.language = normalizeLangCode(parsed.data.language, target);
      ledger.record(out.cost);
      store.set(key, JSON.stringify(parsed.data));
      return { translation: parsed.data, cached: false, cost: out.cost };
    } catch {
      continue;
    }
  }
  return { translation: { ...FALLBACK_TRANSLATION, language: target }, cached: false, cost: 0 };
}
