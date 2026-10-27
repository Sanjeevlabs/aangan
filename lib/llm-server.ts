import { memoryStore, SpendLedger, type LlmStore } from "./llm";

// Module-level model cache + spend ledger shared by all API routes, so
// translations/transcripts/suggestions are cached per card + lang across
// requests and the USD 120 cap is enforced globally.
export const serverStore: LlmStore = memoryStore();

export const serverLedger = new SpendLedger(serverStore);
