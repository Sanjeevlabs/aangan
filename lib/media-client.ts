// Browser-only steps of the client media pipeline. Imported exclusively from
// client components; never from server code or tests.
// Pipeline: validate -> read EXIF date + Make/Model -> re-encode (strips ALL
// EXIF incl. GPS) -> dominant color -> waveform peaks -> session store.

import exifr from "exifr";
import { dateSourceUsed, resolveTakenAt } from "./dating";
import {
  dominantColors,
  peaksFromSamples,
  resolveSource,
  type MediaKind,
  type ProcessedMedia,
} from "./media";
import { putSessionMedia } from "./media-session";
import { validateUpload } from "./uploads";

export interface ProcessOptions {
  fromToday: boolean;
  fromGlassesToggle: boolean;
  caption?: string;
}

export interface ProcessedUpload extends ProcessedMedia {
  mediaRef: string;
  previewUrl: string | null;
  thumbnailRef: string | null;
  thumbnailUrl: string | null;
}

interface ExifTags {
  exifDate: string | null;
  make: string | null;
  model: string | null;
}

async function readExifTags(file: Blob): Promise<ExifTags> {
  try {
    const tags = (await exifr.parse(file, {
      pick: ["DateTimeOriginal", "CreateDate", "Make", "Model"],
    })) as Record<string, unknown> | undefined;
    const raw = tags?.DateTimeOriginal ?? tags?.CreateDate;
    const exifDate = raw instanceof Date && !Number.isNaN(raw.getTime()) ? raw.toISOString() : null;
    const asText = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v : null);
    return { exifDate, make: asText(tags?.Make), model: asText(tags?.Model) };
  } catch {
    return { exifDate: null, make: null, model: null };
  }
}

function canvasToBlob(canvas: HTMLCanvasElement, mime = "image/jpeg", quality = 0.82): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("encode-failed"))), mime, quality);
  });
}

function scaledSize(w: number, h: number, maxDim: number): { w: number; h: number } {
  if (w <= maxDim && h <= maxDim) return { w, h };
  const s = maxDim / Math.max(w, h);
  return { w: Math.max(1, Math.round(w * s)), h: Math.max(1, Math.round(h * s)) };
}

// Re-encode through canvas: output carries zero EXIF (GPS stripped by
// construction). Also yields the dominant palette for wash/art tinting.
async function compressAndStrip(
  bitmap: ImageBitmap,
  maxDim: number,
): Promise<{ blob: Blob; palette: string[]; width: number; height: number }> {
  const { w, h } = scaledSize(bitmap.width, bitmap.height, maxDim);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("no-2d-context");
  ctx.drawImage(bitmap, 0, 0, w, h);
  const blob = await canvasToBlob(canvas);
  const probe = document.createElement("canvas");
  probe.width = 64;
  probe.height = 64;
  const pctx = probe.getContext("2d");
  let palette = ["#ffd9b8", "#ffb59a", "#ffe9d2"];
  if (pctx) {
    pctx.drawImage(canvas, 0, 0, 64, 64);
    const data = pctx.getImageData(0, 0, 64, 64).data;
    palette = dominantColors(data, 3);
  }
  return { blob, palette, width: w, height: h };
}

function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = window.setTimeout(() => reject(new Error(label)), ms);
    p.then(
      (v) => {
        window.clearTimeout(t);
        resolve(v);
      },
      (e) => {
        window.clearTimeout(t);
        reject(e);
      },
    );
  });
}

async function videoInfo(file: Blob): Promise<{ duration: number; thumbnail: Blob | null }> {
  const url = URL.createObjectURL(file);
  try {
    const video = document.createElement("video");
    video.muted = true;
    video.preload = "auto";
    video.src = url;
    await withTimeout(
      new Promise<void>((resolve, reject) => {
        video.onloadedmetadata = () => resolve();
        video.onerror = () => reject(new Error("video-meta-failed"));
      }),
      8000,
      "video-meta-timeout",
    );
    const duration = Number.isFinite(video.duration) ? video.duration : 0;
    let thumbnail: Blob | null = null;
    try {
      video.currentTime = Math.min(0.5, Math.max(0, duration * 0.1));
      await withTimeout(
        new Promise<void>((resolve) => {
          video.onseeked = () => resolve();
          video.onerror = () => resolve();
        }),
        4000,
        "video-seek-timeout",
      );
      const vw = video.videoWidth || 640;
      const vh = video.videoHeight || 640;
      const { w, h } = scaledSize(vw, vh, 640);
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      canvas.getContext("2d")?.drawImage(video, 0, 0, w, h);
      thumbnail = await canvasToBlob(canvas);
    } catch {
      thumbnail = null;
    }
    return { duration, thumbnail };
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function audioPeaks(blob: Blob, buckets = 48): Promise<number[]> {
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return [];
    const ctx = new Ctx();
    try {
      const buf = await ctx.decodeAudioData(await blob.arrayBuffer());
      const data = buf.getChannelData(0);
      return peaksFromSamples(data, buckets);
    } finally {
      await ctx.close().catch(() => undefined);
    }
  } catch {
    return [];
  }
}

export async function processImage(file: File, opts: ProcessOptions): Promise<ProcessedUpload> {
  const tags = await readExifTags(file);
  const bitmap = await createImageBitmap(file).catch(() => {
    throw new Error("unreadable-image");
  });
  try {
    const { blob, palette } = await compressAndStrip(bitmap, 1600);
    const err = validateUpload({ kind: "photo", bytes: blob.size, mime: blob.type });
    if (err) throw new Error(err);
    const takenAt = resolveTakenAt({
      exifDate: tags.exifDate,
      fileModifiedAt: new Date(file.lastModified).toISOString(),
    });
    const takenAtSource = dateSourceUsed({ exifDate: tags.exifDate });
    const stored = putSessionMedia(blob);
    return {
      kind: "photo" satisfies MediaKind,
      bytes: blob.size,
      mime: blob.type,
      takenAt,
      takenAtSource,
      source: resolveSource({
        fromGlassesToggle: opts.fromGlassesToggle,
        exifMake: tags.make,
        exifModel: tags.model,
        fromToday: opts.fromToday,
      }),
      palette,
      peaks: [],
      mediaRef: stored.ref,
      previewUrl: stored.url,
      thumbnailRef: null,
      thumbnailUrl: null,
    };
  } finally {
    bitmap.close();
  }
}

export async function processVideo(file: File, opts: ProcessOptions): Promise<ProcessedUpload> {
  const sizeErr = validateUpload({ kind: "video", bytes: file.size, mime: file.type, durationSeconds: 0 });
  if (sizeErr && sizeErr !== "video exceeds 30s") throw new Error(sizeErr);
  const tags = await readExifTags(file);
  const { duration, thumbnail } = await videoInfo(file);
  const err = validateUpload({ kind: "video", bytes: file.size, mime: file.type, durationSeconds: duration });
  if (err) throw new Error(err);
  const frame = thumbnail ? await createImageBitmap(thumbnail).catch(() => null) : null;
  let palette = ["#ffd9b8", "#ffb59a", "#ffe9d2"];
  if (frame) {
    try {
      const probe = document.createElement("canvas");
      probe.width = 64;
      probe.height = 64;
      probe.getContext("2d")?.drawImage(frame, 0, 0, 64, 64);
      const data = probe.getContext("2d")?.getImageData(0, 0, 64, 64).data;
      if (data) palette = dominantColors(data, 3);
    } finally {
      frame.close();
    }
  }
  const peaks = await audioPeaks(file);
  const takenAt = resolveTakenAt({
    exifDate: tags.exifDate,
    fileModifiedAt: new Date(file.lastModified).toISOString(),
  });
  const takenAtSource = dateSourceUsed({ exifDate: tags.exifDate });
  const stored = putSessionMedia(file);
  const thumbStored = thumbnail ? putSessionMedia(thumbnail) : null;
  return {
    kind: "video" satisfies MediaKind,
    bytes: file.size,
    mime: file.type,
    durationSeconds: duration,
    takenAt,
    takenAtSource,
    source: resolveSource({
      fromGlassesToggle: opts.fromGlassesToggle,
      exifMake: tags.make,
      exifModel: tags.model,
      fromToday: opts.fromToday,
    }),
    palette,
    peaks,
    mediaRef: stored.ref,
    previewUrl: stored.url,
    thumbnailRef: thumbStored?.ref ?? null,
    thumbnailUrl: thumbStored?.url ?? null,
  };
}

// Home image: same pipeline, smaller output; returns the stored ref + palette
// so the Welcome screen can seed the member's adaptive wash.
export async function processHomeImage(file: File): Promise<{ mediaRef: string; palette: string[]; url: string | null }> {
  const bitmap = await createImageBitmap(file).catch(() => {
    throw new Error("unreadable-image");
  });
  try {
    const { blob, palette } = await compressAndStrip(bitmap, 1200);
    const stored = putSessionMedia(blob);
    return { mediaRef: stored.ref, palette, url: stored.url };
  } finally {
    bitmap.close();
  }
}
