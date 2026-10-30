// Two-step ordering through the member's own partner account:
//   preview → cart, total and delivery address read back from the partner;
//   confirm → only with the single-use preview id, from the same member,
//             after an explicit tap (the route requires confirm: true).
// Muse never reaches this module. Payment happens in the partner's own
// flow (UPI QR / store checkout); Aangan never sees payment details.
// Server only.
import { randomBytes } from "crypto";
import { isMockMode } from "../config";
import { NeedsConnect, openPartner } from "./adapter";
import type { Candidate } from "./catalog";
import { pickAddress } from "./catalog";
import { parseAddresses, parseCartTotal, parseCheckout, type ParsedAddress } from "./parse";
import { getPartner, getStore } from "./registry";
import { loadToken } from "./tokens";

const PREVIEW_TTL_MS = 10 * 60_000;

export interface Preview {
  id: string;
  partnerId: string;
  via: string;
  item: { name: string; quantity: number; price: number; image?: string };
  total: number;
  currency: string;
  /** Delivery address from the member's partner account; null when the store's checkout asks for it. */
  address: ParsedAddress | null;
  addresses: ParsedAddress[];
  eta: string | null;
  handoff: boolean;
  sample: boolean;
}

export type ConfirmResult =
  | { status: "placed"; eta: string | null; orderId: string | null; sample: boolean }
  | { status: "awaiting-payment"; paymentUrl: string | null; qr: string | null; orderId: string | null }
  | { status: "handoff"; url: string };

interface Pending {
  preview: Preview;
  candidate: Candidate;
  familyId: string;
  memberId: string;
  exp: number;
}

const pending = new Map<string, Pending>();

export function resetOrders(): void {
  pending.clear();
}

function sampleAddresses(recipientCity: string, ownCity: string): ParsedAddress[] {
  const list: ParsedAddress[] = [];
  if (recipientCity) list.push({ id: "sample-addr-1", label: "Parents' home", line: recipientCity });
  if (ownCity && ownCity !== recipientCity) list.push({ id: "sample-addr-2", label: "Home", line: ownCity });
  if (list.length === 0) list.push({ id: "sample-addr-1", label: "Home", line: "Saved address" });
  return list;
}

/** Shopify cart permalink: the store's own checkout with this variant in the cart. */
export function shopifyCartUrl(domain: string, variantGid: string, quantity = 1): string | null {
  const m = /ProductVariant\/(\d+)$/.exec(variantGid);
  return m ? `https://${domain}/cart/${m[1]}:${quantity}` : null;
}

export async function createPreview(input: {
  familyId: string;
  memberId: string;
  candidate: Candidate;
  recipientCity: string;
  ownCity: string;
  addressId?: string;
}): Promise<Preview> {
  const { candidate: c } = input;
  const partner = getPartner(c.partnerId);
  if (!partner || !partner.sendable) throw new Error("unknown-partner");
  if (partner.transport === "mcp-oauth" && partner.account && !(await loadToken(input.familyId, input.memberId, partner.account))) throw new NeedsConnect(partner.account);

  const base = { id: `pv-${randomBytes(12).toString("base64url")}`, partnerId: c.partnerId, via: c.via, item: { name: c.name, quantity: 1, price: c.price, image: c.image }, currency: c.currency };
  let preview: Preview;

  if (partner.transport === "mcp-public") {
    // Gift stores: the price as the store listed it; the address is entered at the store's checkout.
    preview = { ...base, total: c.price, address: null, addresses: [], eta: null, handoff: true, sample: c.sample };
  } else if (isMockMode() || c.sample) {
    const addresses = sampleAddresses(input.recipientCity, input.ownCity);
    const address = pickAddress(addresses, input.recipientCity, input.addressId) ?? addresses[0];
    preview = { ...base, total: c.price, address, addresses, eta: partner.eta ?? null, handoff: false, sample: true };
  } else {
    const s = await openPartner(input.familyId, input.memberId, partner);
    const addresses = parseAddresses(await s.call(partner.tools?.addresses));
    const address = pickAddress(addresses, input.recipientCity, input.addressId);
    if (!address) throw new Error("no-address");
    await s.call(partner.tools?.clearCart);
    await s.call(partner.tools?.addToCart, { itemId: c.itemId, quantity: 1, addressId: address.id });
    const total = parseCartTotal(await s.call(partner.tools?.cart, { addressId: address.id }));
    if (total === null) throw new Error("no-total");
    preview = { ...base, total, address, addresses, eta: partner.eta ?? null, handoff: false, sample: false };
  }

  const now = Date.now();
  pending.forEach((v, k) => v.exp < now && pending.delete(k));
  pending.set(preview.id, { preview, candidate: c, familyId: input.familyId, memberId: input.memberId, exp: now + PREVIEW_TTL_MS });
  return preview;
}

/** Place the previewed order. Single-use; only the member who previewed it. */
export async function confirmPreview(input: { familyId: string; memberId: string; previewId: string }): Promise<ConfirmResult> {
  const p = pending.get(input.previewId);
  if (!p || p.exp < Date.now() || p.familyId !== input.familyId || p.memberId !== input.memberId) throw new Error("preview-not-found");
  pending.delete(input.previewId);
  const partner = getPartner(p.preview.partnerId);
  if (!partner) throw new Error("unknown-partner");

  if (partner.transport === "mcp-public") {
    const store = p.candidate.storeId ? getStore(p.candidate.storeId) : undefined;
    const url = store ? shopifyCartUrl(store.domain, p.candidate.itemId) : null;
    if (!url) throw new Error("no-handoff");
    return { status: "handoff", url };
  }
  if (partner.transport === "mcp-oauth" && partner.account && !(await loadToken(input.familyId, input.memberId, partner.account))) throw new NeedsConnect(partner.account);
  if (p.preview.sample) return { status: "placed", eta: p.preview.eta, orderId: null, sample: true };

  const s = await openPartner(input.familyId, input.memberId, partner);
  // checkout is not idempotent (Swiggy): one attempt, never retried here.
  const out = parseCheckout(await s.call(partner.tools?.checkout, { addressId: p.preview.address?.id }));
  if (out.paymentUrl || out.qr) return { status: "awaiting-payment", paymentUrl: out.paymentUrl, qr: out.qr, orderId: out.orderId };
  return { status: "placed", eta: p.preview.eta, orderId: out.orderId, sample: false };
}
