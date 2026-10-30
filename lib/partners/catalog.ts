// Searches the curated partners' own catalogues for things to send. Every
// candidate is a real catalogue row (or, in MOCK mode, a labelled sample);
// Muse may only choose among them, never add to them. Server only.
import { isMockMode } from "../config";
import { NeedsConnect, openPartner } from "./adapter";
import { McpClient, toolJson } from "./mcp-client";
import { parseAddresses, parseMcpProducts, parseUcpProducts, type ParsedAddress, type ParsedItem } from "./parse";
import { partnersForCountry, storeMcpUrl, storesForCountry, type GiftStore, type Partner, type SampleItem } from "./registry";
import { loadToken } from "./tokens";

/** The UCP agent profile Shopify asks every catalogue call to carry. Override with UCP_AGENT_PROFILE. */
const UCP_PROFILE = "https://shopify.dev/ucp/agent-profiles/examples/2026-08-25/valid-with-capabilities.json";

export type ContextKind = "occasion" | "need";

export interface Candidate {
  id: string;
  partnerId: string;
  /** "Instamart", "Bombay Sweet Shop". */
  via: string;
  kind: Partner["kind"];
  storeId?: string;
  itemId: string;
  name: string;
  price: number;
  currency: string;
  image?: string;
  url?: string;
  sample: boolean;
  /** Set when the partner needs the member's own account before ordering. */
  account: string | null;
}

// Nothing medical, ever (SPEC §9, §12), and no alcohol or tobacco.
const BLOCKED = /\b(medicin\w*|tablets?|capsules?|syrups?|tonics?|supplements?|vitamins?|pharma\w*|chemist|ayurved\w*|homeopath\w*|immunity|diabet\w*|glucometer|bp monitor|blood pressure|oximeter|thermometer|painkillers?|ointments?|balms?|prescription|wines?|whisk(e)?y|beers?|vodka|rum|gin|liquor|cigar\w*|cigarettes?|tobacco|hookah|vapes?)\b/i;

export function isBlockedText(text: string): boolean {
  return BLOCKED.test(text);
}

function words(s: string): string[] {
  return s.toLowerCase().split(/[^a-zऀ-ॿ]+/).filter((w) => w.length >= 3);
}

function score(item: SampleItem, query: string): number {
  const hay = `${item.name} ${item.tags.join(" ")}`.toLowerCase();
  return words(query).filter((w) => hay.includes(w.replace(/s$/, ""))).length;
}

function queriesFor(p: { queries: Partner["queries"] }, kind: ContextKind, title: string): string[] {
  const base = kind === "need" ? [title, ...p.queries.need] : [...p.queries.occasion];
  return Array.from(new Set(base.map((q) => q.trim()).filter(Boolean))).slice(0, 3);
}

const cid = (partnerId: string, itemId: string, storeId?: string) => `${partnerId}:${storeId ? `${storeId}:` : ""}${itemId}`.slice(0, 200);

function fromSample(p: Partner, s: SampleItem, store?: GiftStore): Candidate {
  return {
    id: cid(p.id, s.id, store?.id),
    partnerId: p.id,
    via: store?.name ?? p.name,
    kind: p.kind,
    storeId: store?.id,
    itemId: s.id,
    name: s.name,
    price: s.price,
    currency: s.currency,
    image: s.image,
    url: s.url,
    sample: true,
    account: p.transport === "mcp-oauth" ? p.account : null,
  };
}

function fromParsed(p: Partner, it: ParsedItem, store?: GiftStore): Candidate {
  return { id: cid(p.id, it.itemId, store?.id), partnerId: p.id, via: store?.name ?? p.name, kind: p.kind, storeId: store?.id, itemId: it.itemId, name: it.name.slice(0, 140), price: it.price, currency: it.currency, image: it.image, url: it.url, sample: false, account: p.transport === "mcp-oauth" ? p.account : null };
}

function mockSearch(partners: Partner[], stores: GiftStore[], kind: ContextKind, title: string): Candidate[] {
  // The member's own words weigh most; each partner's standing queries break ties.
  const rank = (s: SampleItem, qs: string[]) => 3 * (kind === "need" ? score(s, title) : 0) + Math.max(0, ...qs.map((q) => score(s, q)));
  const ranked: { c: Candidate; s: number; order: number }[] = [];
  let order = 0;
  for (const p of partners) {
    if (p.transport === "mcp-public") {
      for (const st of stores) {
        if (kind === "need" && st.queries.need.length === 0) continue;
        const qs = queriesFor(st, kind, title);
        for (const s of st.samples) {
          const sc = rank(s, qs);
          if (sc > 0 || kind === "occasion") ranked.push({ c: fromSample(p, s, st), s: Math.max(1, sc), order: order++ });
        }
      }
      continue;
    }
    const qs = queriesFor(p, kind, title);
    for (const s of p.samples) {
      const sc = rank(s, qs);
      if (sc > 0) ranked.push({ c: fromSample(p, s), s: sc, order: order++ });
    }
  }
  return ranked.sort((a, b) => b.s - a.s || a.order - b.order).map((r) => r.c);
}

/** The recipient's address on a partner account: one in their city, else the first. */
export function pickAddress(addresses: ParsedAddress[], city: string, wanted?: string): ParsedAddress | undefined {
  if (wanted) return addresses.find((a) => a.id === wanted);
  const c = city.trim().toLowerCase();
  return (c && addresses.find((a) => `${a.label} ${a.line}`.toLowerCase().includes(c))) || addresses[0];
}

async function liveStore(p: Partner, st: GiftStore, kind: ContextKind, title: string, country: string): Promise<Candidate[]> {
  const q = kind === "need" ? title : [title, st.queries.occasion[0] ?? "gift"].join(" ");
  const client = new McpClient(storeMcpUrl(st));
  const res = await client.callTool("search_catalog", {
    meta: { "ucp-agent": { profile: process.env.UCP_AGENT_PROFILE || UCP_PROFILE } },
    catalog: { query: q.slice(0, 80), context: { address_country: country }, pagination: { limit: 3 } },
  });
  return parseUcpProducts(toolJson(res))
    .filter((i) => i.available)
    .map((i) => fromParsed(p, i, st));
}

async function liveAccountPartner(familyId: string, memberId: string, p: Partner, kind: ContextKind, title: string, city: string): Promise<Candidate[]> {
  if (!p.account || !(await loadToken(familyId, memberId, p.account))) return [];
  const s = await openPartner(familyId, memberId, p);
  const address = pickAddress(parseAddresses(await s.call(p.tools?.addresses)), city);
  const out: Candidate[] = [];
  for (const query of queriesFor(p, kind, title).slice(0, 2)) {
    const items = parseMcpProducts(await s.call(p.tools?.search, { addressId: address?.id, query }));
    out.push(...items.filter((i) => i.available).slice(0, 3).map((i) => fromParsed(p, i)));
  }
  return out;
}

export interface SearchResult {
  candidates: Candidate[];
  /** Accounts that would add options once connected (live mode only). */
  connectable: string[];
  sample: boolean;
}

export async function searchCandidates(input: { familyId: string; memberId: string; country: string; city: string; kind: ContextKind; title: string }): Promise<SearchResult> {
  const partners = partnersForCountry(input.country).filter((p) => p.sendable);
  const stores = storesForCountry(input.country);
  const clean = (cs: Candidate[]) => {
    const seen = new Set<string>();
    return cs.filter((c) => !isBlockedText(c.name) && !seen.has(c.id) && (seen.add(c.id), true)).slice(0, 12);
  };
  if (isMockMode()) return { candidates: clean(mockSearch(partners, stores, input.kind, input.title)), connectable: [], sample: true };

  const connectable = new Set<string>();
  const jobs = partners.flatMap((p): Promise<Candidate[]>[] => {
    if (p.transport === "mcp-public") return stores.map((st) => liveStore(p, st, input.kind, input.title, input.country));
    if (p.transport === "mcp-oauth")
      return [
        liveAccountPartner(input.familyId, input.memberId, p, input.kind, input.title, input.city).then((cs) => {
          if (cs.length === 0 && p.account) connectable.add(p.account);
          return cs;
        }),
      ];
    return [];
  });
  const settled = await Promise.allSettled(jobs);
  const all: Candidate[] = [];
  for (const r of settled) {
    if (r.status === "fulfilled") all.push(...r.value);
    else if (r.reason instanceof NeedsConnect) connectable.add(r.reason.account);
  }
  // Interleave partners so one store can't crowd the list (no paid placement, ever).
  const byPartner = new Map<string, Candidate[]>();
  for (const c of all) byPartner.set(`${c.partnerId}:${c.storeId ?? ""}`, [...(byPartner.get(`${c.partnerId}:${c.storeId ?? ""}`) ?? []), c]);
  const lists = Array.from(byPartner.values());
  const mixed: Candidate[] = [];
  for (let i = 0; lists.some((l) => l[i]); i++) for (const l of lists) if (l[i]) mixed.push(l[i]);
  return { candidates: clean(mixed), connectable: Array.from(connectable), sample: false };
}

// Candidates the member was shown, so a preview can't be pointed at an item
// (or a price) the server never saw. 30 minutes, bound to the member.
const shown = new Map<string, { c: Candidate; familyId: string; memberId: string; exp: number }>();

export function rememberShown(familyId: string, memberId: string, cs: Candidate[]): void {
  const now = Date.now();
  shown.forEach((v, k) => v.exp < now && shown.delete(k));
  for (const c of cs) shown.set(`${familyId}|${memberId}|${c.id}`, { c, familyId, memberId, exp: now + 30 * 60_000 });
}

export function shownCandidate(familyId: string, memberId: string, id: string): Candidate | null {
  const hit = shown.get(`${familyId}|${memberId}|${id}`);
  return hit && hit.exp > Date.now() ? hit.c : null;
}
