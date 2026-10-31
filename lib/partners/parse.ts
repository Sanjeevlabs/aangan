// Lenient readers for partner tool results. Partners don't all publish result
// schemas, so each reader accepts the few field names we have seen or that
// the docs name, validates types with Zod, and returns null rather than
// guessing. A price we can't read is never invented. Server only.
import { z } from "zod";

const Obj = z.record(z.unknown());
type O = Record<string, unknown>;

function asObj(v: unknown): O | null {
  const p = Obj.safeParse(v);
  return p.success && !Array.isArray(v) ? p.data : null;
}

/** The first array of objects found under any of these dotted paths. */
export function findArray(root: unknown, paths: string[]): O[] {
  for (const path of paths) {
    let cur: unknown = root;
    for (const k of path.split(".")) cur = asObj(cur)?.[k];
    if (Array.isArray(cur)) return cur.map(asObj).filter((x): x is O => x !== null);
  }
  return [];
}

function str(o: O | null, keys: string[]): string | null {
  for (const k of keys) {
    const v = o?.[k];
    if (typeof v === "string" && v.trim()) return v.trim();
    if (typeof v === "number" && Number.isFinite(v)) return String(v);
  }
  return null;
}

/** A price in minor units. Objects {amount, currency} are UCP minor units; bare numbers are major units (₹). */
function price(o: O | null, keys: string[]): number | null {
  for (const k of keys) {
    const v = o?.[k];
    if (typeof v === "number" && Number.isFinite(v) && v >= 0) return Math.round(v * 100);
    if (typeof v === "string" && /^\d+(\.\d+)?$/.test(v.trim())) return Math.round(Number(v) * 100);
    const nested = asObj(v);
    if (nested && typeof nested.amount === "number") return Math.round(nested.amount);
    if (nested) {
      const inner = price(nested, ["offerPrice", "finalPrice", "sellingPrice", "price", "mrp"]);
      if (inner !== null) return inner;
    }
  }
  return null;
}

export interface ParsedItem {
  itemId: string;
  name: string;
  price: number;
  currency: string;
  image?: string;
  url?: string;
  available: boolean;
}

/** Shopify UCP search_catalog: products[].variants[] with minor-unit prices. */
export function parseUcpProducts(json: unknown): ParsedItem[] {
  const out: ParsedItem[] = [];
  for (const p of findArray(json, ["products"])) {
    const variants = findArray(p, ["variants"]);
    const v = variants.find((x) => asObj(x.availability)?.available === true) ?? variants[0];
    const pr = asObj(v?.price);
    const name = str(p, ["title"]);
    const id = str(v ?? null, ["id"]);
    if (!name || !id || !pr || typeof pr.amount !== "number" || typeof pr.currency !== "string") continue;
    const media = findArray(p, ["media"]).find((m) => m.type === "image");
    const url = str(p, ["url"]);
    out.push({
      itemId: id,
      name,
      price: Math.round(pr.amount),
      currency: pr.currency,
      image: typeof media?.url === "string" && media.url.startsWith("https://") ? media.url : undefined,
      url: url?.startsWith("https://") ? url : undefined,
      available: asObj(v?.availability)?.available !== false,
    });
  }
  return out;
}

/** Swiggy/Zomato style: products[] (or items/data.products) with variants[] carrying spinId. Prices in ₹. */
export function parseMcpProducts(json: unknown, currency = "INR"): ParsedItem[] {
  const out: ParsedItem[] = [];
  for (const p of findArray(json, ["products", "items", "data.products", "data.items", "results", "data"])) {
    const variants = findArray(p, ["variants"]);
    const v = variants[0] ?? p;
    const name = str(p, ["displayName", "name", "title"]);
    const id = str(v, ["spinId", "itemId", "id", "variantId"]) ?? str(p, ["spinId", "itemId", "id"]);
    const amount = price(v, ["price", "offerPrice", "finalPrice", "sellingPrice", "mrp"]) ?? price(p, ["price", "offerPrice"]);
    if (!name || !id || amount === null) continue;
    const img = str(v, ["imageUrl", "image"]) ?? str(p, ["imageUrl", "image"]);
    out.push({ itemId: id, name, price: amount, currency, image: img?.startsWith("https://") ? img : undefined, available: v.inStock !== false && v.available !== false });
  }
  return out;
}

export interface ParsedAddress {
  id: string;
  label: string;
  line: string;
}

export function parseAddresses(json: unknown): ParsedAddress[] {
  return findArray(json, ["addresses", "data.addresses", "data", "items"])
    .map((a) => {
      const id = str(a, ["id", "addressId"]);
      const line = str(a, ["displayAddress", "fullAddress", "address", "addressLine", "line"]) ?? "";
      const label = str(a, ["label", "annotation", "tag", "name"]) ?? "Address";
      return id ? { id, label, line: line.slice(0, 120) } : null;
    })
    .filter((x): x is ParsedAddress => x !== null);
}

/** Cart total in minor units, or null when the partner didn't give one we can read. */
export function parseCartTotal(json: unknown): number | null {
  const root = asObj(json);
  const data = asObj(root?.data) ?? root;
  const bill = asObj(data?.bill) ?? asObj(data?.billBreakdown) ?? asObj(data?.bill_details) ?? data;
  return price(bill, ["toPay", "grandTotal", "totalAmount", "total", "finalAmount", "netAmount"]);
}

export function parseCheckout(json: unknown): { orderId: string | null; paymentUrl: string | null; qr: string | null } {
  const root = asObj(json);
  const data = asObj(root?.data) ?? root;
  const payUrl = str(data, ["paymentUrl", "paymentLink", "intentUrl", "upiIntent"]);
  const qr = str(data, ["upiQr", "qrCode", "qr", "upiQrImage"]);
  return {
    orderId: str(data, ["orderId", "order_id", "id"]),
    paymentUrl: payUrl && /^(https:|upi:)/.test(payUrl) ? payUrl : null,
    qr: qr && /^(https:|data:image\/png;base64,|upi:)/.test(qr) ? qr : null,
  };
}
