// Server side of the sticker cut-out: is SAM configured, who may cut out
// what, a small per-person rate limit, and the call to the SAM endpoint
// (modal/sam_server.py). The photo is sent only for this one call and never
// stored; nothing about the person is logged.
import { isMockMode } from "./config";
import { serverLedger } from "./llm-server";
import { canCutOutPhoto, canShareRecipe } from "./share-rules";
import type { Card, Member } from "./schemas";

/** USD per cut-out, a generous estimate of a few GPU seconds on a scale-to-zero endpoint. */
export const CUTOUT_COST_USD = 0.002;
export const CUTOUT_PER_MINUTE = 6;
export const MAX_IMAGE_BYTES = 1_500_000;

export function samConfigured(): boolean {
  return !isMockMode() && Boolean(process.env.SAM_URL && process.env.SAM_API_KEY);
}

const buckets = new Map<string, number[]>();

/** True when this person may make another cut-out now (6 a minute). */
export function takeCutoutSlot(memberId: string, now = Date.now(), max = CUTOUT_PER_MINUTE): boolean {
  const hits = (buckets.get(memberId) ?? []).filter((t) => t > now - 60_000);
  if (hits.length >= max) {
    buckets.set(memberId, hits);
    return false;
  }
  hits.push(now);
  buckets.set(memberId, hits);
  return true;
}

export function clearCutoutSlots(): void {
  buckets.clear();
}

export type CutoutSource = { kind: "card"; id: string } | { kind: "recipe"; id: string };

/** Your own photo (as a grown-up), or a recipe's dish (anyone who may share recipes). */
export function mayCutOut(me: Member, source: CutoutSource, lookup: { card?: Card | null; recipeExists?: boolean }): boolean {
  if (source.kind === "card") return Boolean(lookup.card && lookup.card.familyId === me.familyId && canCutOutPhoto(me, lookup.card));
  return Boolean(lookup.recipeExists) && canShareRecipe(me);
}

/** Decode a data URL of a JPEG/PNG/WebP photo. Null if it isn't one or is too big. */
export function decodePhoto(image: string): { bytes: Uint8Array; type: string } | null {
  const m = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(image);
  if (!m) return null;
  const bytes = Uint8Array.from(Buffer.from(m[2], "base64"));
  if (bytes.length === 0 || bytes.length > MAX_IMAGE_BYTES) return null;
  return { bytes, type: m[1] };
}

/**
 * Ask SAM for the mask of what's under the point. Returns PNG bytes (white =
 * the object) or an error; the caller falls back to a clean crop. Spend:
 * refused past the cap; the estimate is committed only when a mask comes back.
 */
export async function samMask(photo: { bytes: Uint8Array; type: string }, point: { x: number; y: number }, fetcher: typeof fetch = fetch): Promise<{ png: Uint8Array } | { error: "spend-cap" | "sam-failed" }> {
  if (!(await serverLedger.check(CUTOUT_COST_USD))) return { error: "spend-cap" };
  try {
    const res = await fetcher(process.env.SAM_URL as string, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${process.env.SAM_API_KEY}` },
      body: JSON.stringify({ image: Buffer.from(photo.bytes).toString("base64"), point: [point.x, point.y], normalized: true }),
      signal: AbortSignal.timeout(45_000),
    });
    if (!res.ok || !(res.headers.get("content-type") ?? "").includes("image/png")) return { error: "sam-failed" };
    const png = new Uint8Array(await res.arrayBuffer());
    if (png.length < 8 || png[0] !== 0x89 || png[1] !== 0x50) return { error: "sam-failed" };
    await serverLedger.commit(CUTOUT_COST_USD);
    return { png };
  } catch {
    return { error: "sam-failed" };
  }
}
