// Single source of truth for providers and model IDs.
// Nothing here is secret. Keys come from the environment only:
// META_API_KEY (Meta Model API) and BASETEN_API_KEY (Baseten-hosted Muse Spark Open).

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
    // Public model name per 06_muse_voice/01 (utils.py DEFAULT_MODEL).
    transcribeModel: "muse-voice-transcribe-1.0",
    imageModel: "muse-image-1.0",
  },
  baseten: {
    baseUrl: "https://inference.baseten.co/v1",
    captionModel: "meta-models/muse-spark-open-1026",
    transcribeModel: "meta-models/muse-spark-open-1026",
    imageModel: "meta-models/muse-spark-open-1026",
  },
};

/** Each provider's own key. Never send one provider's key to the other. */
export function providerKey(p: ProviderName): string | undefined {
  return p === "baseten" ? process.env.BASETEN_API_KEY : process.env.META_API_KEY;
}

/**
 * Meta's Model API is primary. MUSE_PROVIDER=baseten makes the Baseten-hosted
 * Muse Spark Open primary instead (when its key is set).
 */
export function activeProvider(): ProviderName {
  return process.env.MUSE_PROVIDER === "baseten" && process.env.BASETEN_API_KEY ? "baseten" : "meta";
}

/** Where a failed text/vision call goes next: the other Muse host, if it has a key. */
export function failoverProvider(p: ProviderName): ProviderName | null {
  const other: ProviderName = p === "meta" ? "baseten" : "meta";
  return providerKey(other) ? other : null;
}

export function isMockMode(): boolean {
  return process.env.MOCK === "true" || !providerKey(activeProvider());
}
