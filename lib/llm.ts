import { createHash } from "crypto";
import { activeProvider, isMockMode, PROVIDERS, SPEND_CAP_USD } from "./config";
import { CaptionSchema, type Caption } from "./schemas";

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
      max_tokens: 300,
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
      ledger.record(out.cost);
      store.set(key, JSON.stringify(parsed.data));
      return { caption: parsed.data, cached: false, cost: out.cost };
    } catch {
      continue;
    }
  }
  return { caption: FALLBACK_CAPTION, cached: false, cost: 0 };
}
