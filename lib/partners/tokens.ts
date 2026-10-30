// Partner tokens, kept server-side per member + partner account. Sealed
// (AES-GCM) before storage; nothing here is ever returned to a client or
// logged. Storage sits behind a small interface: an in-memory map today;
// a family doc kind "partner_token" once lib/kinds.ts has it.
import { z } from "zod";
import { seal, unseal } from "./seal";

export const TokenSetSchema = z.object({
  accessToken: z.string().min(1),
  refreshToken: z.string().min(1).optional(),
  /** ms since epoch; absent = unknown. */
  expiresAt: z.number().optional(),
  clientId: z.string().optional(),
  sample: z.boolean().default(false),
});
export type TokenSet = z.infer<typeof TokenSetSchema>;

/** The stored row: what a "partner_token" family doc would hold. */
export const PartnerTokenRowSchema = z.object({
  id: z.string(),
  memberId: z.string(),
  account: z.string(),
  sealed: z.string().min(1),
  connectedAt: z.string(),
});
export type PartnerTokenRow = z.infer<typeof PartnerTokenRowSchema>;

export interface PartnerTokenStore {
  get(familyId: string, id: string): Promise<PartnerTokenRow | undefined>;
  list(familyId: string): Promise<PartnerTokenRow[]>;
  put(familyId: string, row: PartnerTokenRow): Promise<void>;
  delete(familyId: string, id: string): Promise<void>;
}

export function memoryTokenStore(rows = new Map<string, PartnerTokenRow>()): PartnerTokenStore & { clear(): void } {
  const k = (f: string, id: string) => `${f}::${id}`;
  return {
    async get(f, id) {
      return rows.get(k(f, id));
    },
    async list(f) {
      return Array.from(rows.entries()).filter(([key]) => key.startsWith(`${f}::`)).map(([, r]) => r);
    },
    async put(f, row) {
      rows.set(k(f, row.id), PartnerTokenRowSchema.parse(row));
    },
    async delete(f, id) {
      rows.delete(k(f, id));
    },
    clear() {
      rows.clear();
    },
  };
}

// On globalThis so every route bundle (and a dev recompile) sees the same rows.
const g = globalThis as typeof globalThis & { __aanganPartnerTokens?: Map<string, PartnerTokenRow> };
const memory = memoryTokenStore((g.__aanganPartnerTokens ??= new Map<string, PartnerTokenRow>()));
let store: PartnerTokenStore = memory;

/** Swap in the family-docs backed store once the "partner_token" kind exists. */
export function setTokenStore(s: PartnerTokenStore): void {
  store = s;
}

export function resetTokens(): void {
  memory.clear();
  store = memory;
}

const SEAL_PURPOSE = "partner-token";
export const tokenRowId = (memberId: string, account: string) => `ptok-${memberId}-${account}`;

export async function saveToken(familyId: string, memberId: string, account: string, tokens: TokenSet): Promise<boolean> {
  const sealed = seal(SEAL_PURPOSE, TokenSetSchema.parse(tokens));
  if (!sealed) return false;
  await store.put(familyId, { id: tokenRowId(memberId, account), memberId, account, sealed, connectedAt: new Date().toISOString() });
  return true;
}

/** The member's own token for an account. The row must belong to that member. */
export async function loadToken(familyId: string, memberId: string, account: string): Promise<TokenSet | null> {
  const row = await store.get(familyId, tokenRowId(memberId, account));
  if (!row || row.memberId !== memberId || row.account !== account) return null;
  const parsed = TokenSetSchema.safeParse(unseal(SEAL_PURPOSE, row.sealed));
  return parsed.success ? parsed.data : null;
}

export async function deleteToken(familyId: string, memberId: string, account: string): Promise<void> {
  await store.delete(familyId, tokenRowId(memberId, account));
}

/** Which accounts this member has connected, and when. Never the token. */
export async function connections(familyId: string, memberId: string): Promise<{ account: string; connectedAt: string }[]> {
  return (await store.list(familyId)).filter((r) => r.memberId === memberId).map((r) => ({ account: r.account, connectedAt: r.connectedAt }));
}
