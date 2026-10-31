// Client-side image work for Muse Image results. Browser only.
// - bakeMark: the small "Painted by Muse" / "Restored by Muse" mark drawn
//   into the pixels, so a kept image never passes as a real photo, wherever
//   it travels.
// - paintSamplePortrait / restoreSample: when Muse is off (mock mode, no key)
//   a convincing, clearly labelled sample made on the device from the same
//   photos. No model, no network.
import { putSessionMedia } from "./media-session";
import { uploadToStorage } from "./media-client";
import { SAMPLE_MARK, type PortraitStyle } from "./muse-portrait";

export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = "async";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("image-unreadable"));
    img.src = src;
  });
}

function canvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d");
  if (!ctx) throw new Error("no-canvas");
  return [c, ctx];
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function pill(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, size: number, align: "left" | "right") {
  ctx.save();
  ctx.font = `600 ${size}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
  const label = `✦ ${text}`;
  const w = ctx.measureText(label).width + size * 1.4;
  const h = size * 1.9;
  const left = align === "right" ? x - w : x;
  ctx.fillStyle = "rgba(255,255,255,0.86)";
  roundRect(ctx, left, y, w, h, h / 2);
  ctx.fill();
  ctx.fillStyle = "#1c1b1a";
  ctx.textBaseline = "middle";
  ctx.fillText(label, left + size * 0.7, y + h / 2 + 1);
  ctx.restore();
}

/** Bakes the Muse mark into the bottom-right corner (and the sample label top-left when Muse was off). */
export function bakeMark(c: HTMLCanvasElement, mark: string, sample = false): HTMLCanvasElement {
  const ctx = c.getContext("2d");
  if (!ctx) return c;
  const size = Math.max(14, Math.round(Math.min(c.width, c.height) * 0.028));
  const pad = Math.round(size * 0.9);
  pill(ctx, mark, c.width - pad, c.height - pad - size * 1.9, size, "right");
  if (sample) pill(ctx, SAMPLE_MARK, pad, pad, size, "left");
  return c;
}

function noise(size = 160, alpha = 22): HTMLCanvasElement {
  const [c, ctx] = canvas(size, size);
  const data = ctx.createImageData(size, size);
  for (let i = 0; i < data.data.length; i += 4) {
    const v = 120 + Math.floor(Math.random() * 120);
    data.data[i] = v;
    data.data[i + 1] = v - 6;
    data.data[i + 2] = v - 16;
    data.data[i + 3] = Math.floor(Math.random() * alpha);
  }
  ctx.putImageData(data, 0, 0);
  return c;
}

const PAPER: Record<PortraitStyle, { bg: [string, string]; filter: string; ink: string }> = {
  watercolour: { bg: ["#fbf4e6", "#efe0c4"], filter: "blur(1.4px) saturate(1.25) contrast(0.92) brightness(1.06)", ink: "rgba(176,118,74,0.16)" },
  oil: { bg: ["#5a3b24", "#2b1a10"], filter: "saturate(1.45) contrast(1.18) blur(0.7px) sepia(0.18)", ink: "rgba(255,214,150,0.12)" },
  pencil: { bg: ["#f7f1e3", "#e6dcc6"], filter: "grayscale(1) contrast(1.55) brightness(1.12) blur(0.5px)", ink: "rgba(60,60,60,0.10)" },
  festive: { bg: ["#ffe2a8", "#f2a65a"], filter: "saturate(1.6) contrast(1.12) blur(0.5px)", ink: "rgba(214,72,40,0.14)" },
};

/** Where each face sits: a gentle oval for a group, a row for two or three. */
export function ovalSlots(n: number, w: number, h: number): { x: number; y: number; r: number }[] {
  if (n <= 0) return [];
  const r = Math.min(w, h) * (n <= 2 ? 0.24 : n === 3 ? 0.21 : n <= 4 ? 0.18 : n <= 6 ? 0.15 : 0.12);
  if (n <= 3) {
    const gap = w / (n + 1);
    return Array.from({ length: n }, (_, i) => ({ x: gap * (i + 1), y: h * 0.52 + (i % 2 ? r * 0.18 : 0), r }));
  }
  // Everyone around one oval, like a wreath of faces.
  return Array.from({ length: n }, (_, i) => {
    const t = -Math.PI / 2 + Math.PI / n + (i * 2 * Math.PI) / n;
    return { x: w / 2 + Math.cos(t) * w * 0.3, y: h * 0.5 + Math.sin(t) * h * 0.28, r };
  });
}

/** Turns a photo square into paint: soft brushy colour fields and flattened tones (or a graphite sketch). */
function paintify(ctx: CanvasRenderingContext2D, d: number, style: PortraitStyle): void {
  if (style === "pencil") {
    // Classic dodge sketch: grey / (1 - blurred inverted grey).
    const gx = canvas(d, d)[1];
    gx.filter = "grayscale(1)";
    gx.drawImage(ctx.canvas, 0, 0);
    const bx = canvas(d, d)[1];
    bx.filter = "grayscale(1) invert(1) blur(5px)";
    bx.drawImage(ctx.canvas, 0, 0);
    const g = gx.getImageData(0, 0, d, d);
    const b = bx.getImageData(0, 0, d, d).data;
    for (let i = 0; i < g.data.length; i += 4) {
      const v = Math.min(255, (g.data[i] * 255) / Math.max(1, 255 - b[i]));
      const t = Math.pow(v / 255, 2.2) * 255;
      g.data[i] = t * 0.98;
      g.data[i + 1] = t * 0.96;
      g.data[i + 2] = t * 0.9;
    }
    ctx.putImageData(g, 0, 0);
    return;
  }
  const small = Math.max(24, Math.round(d / (style === "festive" ? 9 : 7)));
  const [sc, sx] = canvas(small, small);
  sx.drawImage(ctx.canvas, 0, 0, small, small);
  ctx.save();
  ctx.imageSmoothingQuality = "high";
  ctx.globalAlpha = style === "festive" ? 0.7 : 0.5;
  ctx.drawImage(sc, 0, 0, d, d);
  ctx.restore();
  const levels = style === "festive" ? 4 : style === "oil" ? 6 : 7;
  const step = 255 / (levels - 1);
  const px = ctx.getImageData(0, 0, d, d);
  for (let i = 0; i < px.data.length; i += 4) {
    for (let ch = 0; ch < 3; ch++) {
      let v = Math.round(px.data[i + ch] / step) * step;
      if (style === "watercolour") v = v * 0.82 + [252, 244, 230][ch] * 0.18; // let the paper through
      px.data[i + ch] = v;
    }
  }
  ctx.putImageData(px, 0, 0);
}

/** A labelled on-device sample portrait from the chosen photos (Muse is off). */
export async function paintSamplePortrait(srcs: string[], style: PortraitStyle, mark: string): Promise<HTMLCanvasElement> {
  const W = 1200;
  const H = 900;
  const [c, ctx] = canvas(W, H);
  const look = PAPER[style];
  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, look.bg[0]);
  bg.addColorStop(1, look.bg[1]);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);
  // Loose washes behind the family.
  for (let i = 0; i < 14; i++) {
    ctx.fillStyle = look.ink;
    ctx.beginPath();
    ctx.ellipse(Math.random() * W, Math.random() * H, 80 + Math.random() * 220, 60 + Math.random() * 160, Math.random() * Math.PI, 0, Math.PI * 2);
    ctx.fill();
  }
  if (style === "festive") {
    // String lights and marigolds along the top.
    for (let k = 0; k < 2; k++) {
      ctx.strokeStyle = "rgba(90,50,20,0.45)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      const y0 = 40 + k * 46;
      ctx.moveTo(0, y0);
      ctx.quadraticCurveTo(W / 2, y0 + 70, W, y0);
      ctx.stroke();
      for (let i = 1; i < 18; i++) {
        const t = i / 18;
        const x = t * W;
        const y = (1 - t) * (1 - t) * y0 + 2 * (1 - t) * t * (y0 + 70) + t * t * y0;
        ctx.fillStyle = k ? (i % 2 ? "#f6b21a" : "#e8641c") : ["#ffd76a", "#ff9a52", "#fff1b8"][i % 3];
        ctx.beginPath();
        ctx.arc(x, y + 8, k ? 13 : 7, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  const imgs = (await Promise.all(srcs.map((s) => loadImage(s).catch(() => null)))).filter((x): x is HTMLImageElement => Boolean(x));
  const slots = ovalSlots(imgs.length, W, H);
  // Back row first, so the centre face sits on top.
  const order = slots.map((s, i) => ({ s, i })).sort((a, b) => a.s.y - b.s.y || (a.i === 0 ? 1 : -1));
  for (const { s, i } of order) {
    const img = imgs[i];
    const d = Math.round(s.r * 2.2);
    const [fc, fx] = canvas(d, d);
    // Centre-crop, a little high: faces live in the top third of a portrait.
    const side = Math.min(img.naturalWidth, img.naturalHeight);
    const sx = (img.naturalWidth - side) / 2;
    const sy = Math.max(0, (img.naturalHeight - side) * 0.3);
    fx.filter = look.filter;
    fx.drawImage(img, sx, sy, side, side, 0, 0, d, d);
    fx.filter = "none";
    paintify(fx, d, style);
    // Feathered oval edge, like paint fading into paper.
    fx.globalCompositeOperation = "destination-in";
    const g = fx.createRadialGradient(d / 2, d / 2, d * 0.28, d / 2, d / 2, d / 2);
    g.addColorStop(0, "rgba(0,0,0,1)");
    g.addColorStop(0.75, "rgba(0,0,0,0.85)");
    g.addColorStop(1, "rgba(0,0,0,0)");
    fx.fillStyle = g;
    fx.beginPath();
    fx.ellipse(d / 2, d / 2, d / 2, d / 2 * 1.08, 0, 0, Math.PI * 2);
    fx.fill();
    ctx.drawImage(fc, s.x - d / 2, s.y - d / 2);
  }

  // Paper grain and darkened edges.
  const pattern = ctx.createPattern(noise(), "repeat");
  if (pattern) {
    ctx.fillStyle = pattern;
    ctx.fillRect(0, 0, W, H);
  }
  const v = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.72);
  v.addColorStop(0, "rgba(0,0,0,0)");
  v.addColorStop(1, style === "oil" ? "rgba(0,0,0,0.55)" : "rgba(80,50,20,0.32)");
  ctx.fillStyle = v;
  ctx.fillRect(0, 0, W, H);
  return bakeMark(c, mark, true);
}

/** Per-channel auto-levels (1st-99th percentile) plus a light denoise. The faces stay as they are. */
export function autoLevels(data: Uint8ClampedArray): void {
  const lo = [0, 0, 0];
  const hi = [255, 255, 255];
  const total = data.length / 4;
  for (let ch = 0; ch < 3; ch++) {
    const hist = new Array<number>(256).fill(0);
    for (let i = ch; i < data.length; i += 4) hist[data[i]]++;
    let acc = 0;
    for (let v = 0; v < 256; v++) {
      acc += hist[v];
      if (acc >= total * 0.01) {
        lo[ch] = v;
        break;
      }
    }
    acc = 0;
    for (let v = 255; v >= 0; v--) {
      acc += hist[v];
      if (acc >= total * 0.01) {
        hi[ch] = v;
        break;
      }
    }
  }
  for (let i = 0; i < data.length; i += 4) {
    for (let ch = 0; ch < 3; ch++) {
      const span = Math.max(24, hi[ch] - lo[ch]);
      data[i + ch] = ((data[i + ch] - lo[ch]) * 255) / span;
    }
  }
}

/** A labelled on-device sample restore (Muse is off). */
export async function restoreSample(src: string, mark: string): Promise<HTMLCanvasElement> {
  const img = await loadImage(src);
  const scale = Math.min(1, 1600 / Math.max(img.naturalWidth, img.naturalHeight));
  const w = Math.round(img.naturalWidth * scale);
  const h = Math.round(img.naturalHeight * scale);
  const [c, ctx] = canvas(w, h);
  ctx.drawImage(img, 0, 0, w, h);
  // Light denoise: blend a softened copy over the original.
  ctx.globalAlpha = 0.45;
  ctx.filter = "blur(1px)";
  ctx.drawImage(img, 0, 0, w, h);
  ctx.filter = "none";
  ctx.globalAlpha = 1;
  const px = ctx.getImageData(0, 0, w, h);
  autoLevels(px.data);
  ctx.putImageData(px, 0, 0);
  // A touch of warmth back into faded prints.
  ctx.globalCompositeOperation = "soft-light";
  ctx.fillStyle = "rgba(255,200,140,0.18)";
  ctx.fillRect(0, 0, w, h);
  ctx.globalCompositeOperation = "source-over";
  return bakeMark(c, mark, true);
}

/** A live Muse result (data URL) with the mark baked in. */
export async function markResult(dataUrl: string, mark: string): Promise<HTMLCanvasElement> {
  const img = await loadImage(dataUrl);
  const [c, ctx] = canvas(img.naturalWidth, img.naturalHeight);
  ctx.drawImage(img, 0, 0);
  return bakeMark(c, mark, false);
}

export function canvasBlob(c: HTMLCanvasElement, type = "image/jpeg", q = 0.9): Promise<Blob> {
  return new Promise((resolve, reject) => c.toBlob((b) => (b ? resolve(b) : reject(new Error("no-blob"))), type, q));
}

/** A picked file → a downscaled JPEG data URL (what Muse is sent). */
export async function fileToDataUrl(file: Blob, max = 1600): Promise<{ dataUrl: string; w: number; h: number }> {
  const url = URL.createObjectURL(file);
  try {
    const img = await loadImage(url);
    const scale = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
    const [c, ctx] = canvas(Math.round(img.naturalWidth * scale), Math.round(img.naturalHeight * scale));
    ctx.drawImage(img, 0, 0, c.width, c.height);
    return { dataUrl: c.toDataURL("image/jpeg", 0.88), w: c.width, h: c.height };
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Muse's three output shapes, from the photo's own proportions. */
export function sizeFor(w: number, h: number): "1024x1024" | "1024x1536" | "1536x1024" {
  const r = w / Math.max(1, h);
  return r > 1.2 ? "1536x1024" : r < 0.83 ? "1024x1536" : "1024x1024";
}

/** Stores a blob the way any upload is stored: private storage, else this tab. */
export async function storeBlob(blob: Blob): Promise<{ ref: string; url: string | null }> {
  const local = putSessionMedia(blob);
  const persisted = await uploadToStorage(blob, "muse.jpg", "image/jpeg");
  return { ref: persisted ?? local.ref, url: local.url };
}

/** Keep a render: it becomes a family card, labelled by the server from the render's kind. */
export async function keepRender(input: { runId: string; blob: Blob; caption?: string; takenAt?: string; place?: string; note?: string; originalRef?: string }): Promise<boolean> {
  const { ref } = await storeBlob(input.blob);
  const res = await fetch("/api/muse/keep", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ runId: input.runId, mediaRef: ref, originalRef: input.originalRef, caption: input.caption ?? "", takenAt: input.takenAt, place: input.place ?? "", note: input.note ?? "" }),
  });
  return res.ok;
}
