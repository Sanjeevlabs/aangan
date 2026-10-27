// Single source of truth for providers and model IDs.
// Nothing here is secret. The API key always comes from META_API_KEY env.

export const SPEND_CAP_USD = 120;

export type ProviderName = "meta" | "baseten";

export interface ProviderConfig {
  baseUrl: string;
  captionModel: string;
  transcribeModel: string;
  imageModel: string;
}

export const PROVIDERS: Record<ProviderName, ProviderConfig> = {
  meta: {
    baseUrl: "https://api.meta.ai/v1",
    captionModel: "muse-spark-1.3",
    transcribeModel: "muse-voice-transcribe",
    imageModel: "muse-image-style",
  },
  baseten: {
    baseUrl: "https://inference.baseten.co/v1",
    captionModel: "meta-models/muse-spark-open-1026",
    transcribeModel: "meta-models/muse-spark-open-1026",
    imageModel: "meta-models/muse-spark-open-1026",
  },
};

// Baseten is used only when credits are confirmed via env.
export function activeProvider(): ProviderName {
  return process.env.BASETEN_CREDITS_CONFIRMED === "1" ? "baseten" : "meta";
}

export function isMockMode(): boolean {
  return process.env.MOCK === "true" || !process.env.META_API_KEY;
}
