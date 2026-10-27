import type { CardSource } from "./schemas";

// Pure core of the client media pipeline. Browser-only steps (EXIF read via
// exifr, canvas compress/re-encode, thumbnails, audio decode) live in
// lib/media-client.ts; everything here runs in Node and is unit-tested.

export type MediaKind = "photo" | "audio" | "video";

export interface ProcessedMedia {
  kind: MediaKind;
  bytes: number;
  mime: string;
  durationSeconds?: number;
  takenAt: string;
  takenAtSource: "exif" | "file" | "model" | "now";
  source: CardSource;
  palette: string[];
  peaks: number[];
}

// Glasses detection: EXIF Make/Model naming Meta, Ray-Ban, or Oakley means
// the photo was captured hands-free. Word-boundary match on "meta" avoids
// false positives (e.g. "Metax"); Ray-Ban matches with or without hyphen.
export function isGlassesCapture(make?: string | null, model?: string | null): boolean {
  const hay = `${make ?? ""} ${model ?? ""}`.toLowerCase();
  if (hay.includes("oakley")) return true;
  if (hay.includes("ray-ban") || hay.includes("rayban")) return true;
  return /\bmeta\b/.test(hay);
}

export interface SourceInput {
  fromGlassesToggle: boolean;
  exifMake?: string | null;
  exifModel?: string | null;
  fromToday: boolean;
}

// Glasses evidence (EXIF or the manual toggle) wins; otherwise a photo taken
// from the shared "today" pool is source 'today'; all else is 'upload'.
export function resolveSource(input: SourceInput): CardSource {
  if (input.fromGlassesToggle) return "glasses";
  if (isGlassesCapture(input.exifMake, input.exifModel)) return "glasses";
  if (input.fromToday) return "today";
  return "upload";
}

// Waveform peaks: max absolute amplitude per bucket, clamped to [0, 1].
// Stored with voice/video cards so static waves render without decoding.
export function peaksFromSamples(samples: ArrayLike<number>, buckets: number): number[] {
  if (buckets < 1) return [];
  if (samples.length === 0) return new Array(buckets).fill(0);
  const out: number[] = new Array(buckets).fill(0);
  const perBucket = samples.length / buckets;
  for (let b = 0; b < buckets; b++) {
    const start = Math.floor(b * perBucket);
    const end = Math.max(start + 1, Math.floor((b + 1) * perBucket));
    let max = 0;
    for (let i = start; i < end && i < samples.length; i++) {
      const v = Math.abs(samples[i]);
      if (v > max) max = v;
    }
    out[b] = Math.min(1, max);
  }
  return out;
}

export function toHex(r: number, g: number, b: number): string {
  const h = (v: number) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0");
  return `#${h(r)}${h(g)}${h(b)}`;
}

function saturation(r: number, g: number, b: number): number {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  return max === 0 ? 0 : (max - min) / max;
}

// Dominant colors from raw RGBA pixels. Quantizes to 3-bit channels, scores
// buckets by saturation-weighted frequency (colorful wins for the wash),
// returns the top `count` as hex. Deterministic: ties break by bucket key.
export function dominantColors(pixels: ArrayLike<number>, count = 3): string[] {
  const buckets = new Map<number, { n: number; r: number; g: number; b: number }>();
  for (let i = 0; i + 3 < pixels.length + 1; i += 4) {
    const r = pixels[i];
    const g = pixels[i + 1];
    const b = pixels[i + 2];
    const key = ((r >> 5) << 6) | ((g >> 5) << 3) | (b >> 5);
    const cur = buckets.get(key) ?? { n: 0, r: 0, g: 0, b: 0 };
    cur.n += 1;
    cur.r += r;
    cur.g += g;
    cur.b += b;
    buckets.set(key, cur);
  }
  const scored = Array.from(buckets.entries()).map(([key, v]) => {
    const r = v.r / v.n;
    const g = v.g / v.n;
    const b = v.b / v.n;
    return { key, score: v.n * (1 + saturation(r, g, b)), hex: toHex(r, g, b) };
  });
  scored.sort((a, b) => b.score - a.score || a.key - b.key);
  return scored.slice(0, Math.max(1, count)).map((s) => s.hex);
}

// Home image precedence: per-member photo, then family default, then the
// illustrated courtyard fallback (null here; the UI renders CourtyardArt).
export function resolveHomeImage(
  memberRef: string | null | undefined,
  familyRef: string | null | undefined,
): string | null {
  return memberRef ?? familyRef ?? null;
}
