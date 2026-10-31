// Stickers: 512×512 transparent PNGs with a thick white die-cut outline and a
// soft shadow, the format messengers use. Drawn in the browser; the only
// thing that may leave the device is a photo sent for a cut-out (SAM), and
// only when the person asks for one (see app/api/stickers/cutout).
import { cardFonts, drawCover, fitText, loadImage, makeCanvas, toPng, type Fonts } from "./card-kit";

export const STICKER = 512;
const MARGIN = 34; // room for the outline and the shadow
const OUTLINE = 14;

export type CropShape = "circle" | "rounded";
export interface Point {
  /** 0…1 across the photo */
  x: number;
  /** 0…1 down the photo */
  y: number;
}

/** Fit any shape (transparent canvas) into a sticker with a white die-cut edge and a soft shadow. */
/** Crop a transparent canvas to what's drawn on it. */
function trim(c: HTMLCanvasElement): HTMLCanvasElement {
  const ctx = c.getContext("2d");
  if (!ctx) return c;
  const { data, width: W, height: H } = ctx.getImageData(0, 0, c.width, c.height);
  let minX = W;
  let minY = H;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (data[(y * W + x) * 4 + 3] > 8) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0 || (minX === 0 && minY === 0 && maxX === W - 1 && maxY === H - 1)) return c;
  const out = makeCanvas(maxX - minX + 1, maxY - minY + 1);
  if (!out) return c;
  out.ctx.drawImage(c, minX, minY, out.canvas.width, out.canvas.height, 0, 0, out.canvas.width, out.canvas.height);
  return out.canvas;
}

export function dieCut(drawn: HTMLCanvasElement, size = STICKER): HTMLCanvasElement {
  const shape = trim(drawn);
  const out = makeCanvas(size, size);
  if (!out) return shape;
  const inner = size - MARGIN * 2;
  const s = Math.min(inner / shape.width, inner / shape.height);
  const w = Math.round(shape.width * s);
  const h = Math.round(shape.height * s);
  const x = Math.round((size - w) / 2);
  const y = Math.round((size - h) / 2) - 4;

  // The outline: the silhouette, spread in every direction, painted white.
  const sil = makeCanvas(size, size);
  if (!sil) return shape;
  const steps = 40;
  for (const r of [OUTLINE * 0.5, OUTLINE]) {
    for (let i = 0; i < steps; i++) {
      const a = (i / steps) * Math.PI * 2;
      sil.ctx.drawImage(shape, x + Math.cos(a) * r, y + Math.sin(a) * r, w, h);
    }
  }
  sil.ctx.drawImage(shape, x, y, w, h);
  sil.ctx.globalCompositeOperation = "source-in";
  sil.ctx.fillStyle = "#ffffff";
  sil.ctx.fillRect(0, 0, size, size);

  const { ctx } = out;
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,.30)";
  ctx.shadowBlur = 16;
  ctx.shadowOffsetY = 6;
  ctx.drawImage(sil.canvas, 0, 0);
  ctx.restore();
  ctx.drawImage(shape, x, y, w, h);
  return out.canvas;
}

/** A photo's mask from SAM (white = keep) applied as alpha, cropped to what's kept. Null when the mask is empty. */
async function maskedCutout(img: HTMLImageElement, mask: Blob): Promise<HTMLCanvasElement | null> {
  const url = URL.createObjectURL(mask);
  const m = await loadImage(url);
  URL.revokeObjectURL(url);
  if (!m) return null;
  const scale = Math.min(1, 1024 / Math.max(img.width, img.height));
  const W = Math.round(img.width * scale);
  const H = Math.round(img.height * scale);
  const work = makeCanvas(W, H);
  const mk = makeCanvas(W, H);
  if (!work || !mk) return null;
  work.ctx.drawImage(img, 0, 0, W, H);
  mk.ctx.drawImage(m, 0, 0, W, H);
  const data = mk.ctx.getImageData(0, 0, W, H);
  const px = data.data;
  let minX = W;
  let minY = H;
  let maxX = -1;
  let maxY = -1;
  for (let i = 0, p = 0; i < px.length; i += 4, p++) {
    // Luminance becomes alpha (a mask PNG may be grey, RGB or already alpha).
    const a = Math.min(px[i + 3], Math.max(px[i], px[i + 1], px[i + 2]));
    px[i] = 255;
    px[i + 1] = 255;
    px[i + 2] = 255;
    px[i + 3] = a;
    if (a > 24) {
      const xx = p % W;
      const yy = (p - xx) / W;
      if (xx < minX) minX = xx;
      if (xx > maxX) maxX = xx;
      if (yy < minY) minY = yy;
      if (yy > maxY) maxY = yy;
    }
  }
  if (maxX < 0 || (maxX - minX) * (maxY - minY) < W * H * 0.004) return null;
  mk.ctx.putImageData(data, 0, 0);
  work.ctx.globalCompositeOperation = "destination-in";
  work.ctx.drawImage(mk.canvas, 0, 0);
  const cw = maxX - minX + 1;
  const ch = maxY - minY + 1;
  const crop = makeCanvas(cw, ch);
  if (!crop) return null;
  crop.ctx.drawImage(work.canvas, minX, minY, cw, ch, 0, 0, cw, ch);
  return crop.canvas;
}

/** A clean circle (or rounded square) of the photo around the tapped point. */
function cropAround(img: HTMLImageElement, at: Point, shape: CropShape, size = 900): HTMLCanvasElement | null {
  const c = makeCanvas(size, size);
  if (!c) return null;
  const short = Math.min(img.width, img.height);
  const r = short * 0.3;
  const cx = Math.min(Math.max(at.x * img.width, r), img.width - r);
  const cy = Math.min(Math.max(at.y * img.height, r), img.height - r);
  const { ctx } = c;
  ctx.beginPath();
  if (shape === "circle") ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
  else ctx.roundRect(0, 0, size, size, size * 0.2);
  ctx.clip();
  ctx.drawImage(img, cx - r, cy - r, r * 2, r * 2, 0, 0, size, size);
  return c.canvas;
}

/** The subject of a photo: SAM's cut-out when there is a mask, otherwise a clean crop. */
export async function subjectShape(src: string, at: Point, mask: Blob | null, shape: CropShape): Promise<HTMLCanvasElement | null> {
  const img = await loadImage(src);
  if (!img) return null;
  const cut = mask ? await maskedCutout(img, mask) : null;
  return cut ?? cropAround(img, at, shape);
}

function handLabel(ctx: CanvasRenderingContext2D, fonts: Fonts, text: string, cx: number, top: number, maxW: number, color: string): number {
  const fit = fitText(ctx, text, (px) => `400 ${px}px ${fonts.hand}`, maxW, 2, 120, 64);
  ctx.font = `400 ${fit.px}px ${fonts.hand}`;
  ctx.fillStyle = color;
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  let y = top;
  for (const l of fit.lines) {
    ctx.fillText(l, cx, y);
    y += fit.px * 1.05;
  }
  return y;
}

/** A person or a dish from a photo, optionally with a handwritten label ("Maa's aloo paratha"). */
export async function photoSticker(opts: { src: string; at: Point; mask: Blob | null; shape: CropShape; label?: string }): Promise<Blob | null> {
  const subject = await subjectShape(opts.src, opts.at, opts.mask, opts.shape);
  if (!subject) return null;
  if (!opts.label?.trim()) return toPng(dieCut(subject));
  const fonts = await cardFonts();
  // Subject on top, the label underneath, close enough that the outline joins them.
  const W = 1000;
  const subH = 700;
  const s = Math.min(W / subject.width, subH / subject.height);
  const sw = subject.width * s;
  const sh = subject.height * s;
  const c = makeCanvas(W, sh + 300);
  if (!c) return null;
  c.ctx.drawImage(subject, (W - sw) / 2, 0, sw, sh);
  const end = handLabel(c.ctx, fonts, opts.label.trim(), W / 2, sh + 6, W - 40, "#2a1d12");
  const trimmed = makeCanvas(W, Math.ceil(end + 10));
  if (!trimmed) return null;
  trimmed.ctx.drawImage(c.canvas, 0, 0);
  return toPng(dieCut(trimmed.canvas));
}

/** An elder's few words, handwritten on a paper-cut shape. */
export async function blessingSticker(opts: { words: string; by: string }): Promise<Blob | null> {
  const fonts = await cardFonts();
  const W = 1000;
  const H = 820;
  const c = makeCanvas(W, H);
  if (!c) return null;
  const { ctx } = c;
  // Paper-cut: a rounded card with a scalloped edge, slightly turned.
  ctx.translate(W / 2, H / 2);
  ctx.rotate(-0.04);
  ctx.translate(-W / 2, -H / 2);
  const bx = 70;
  const by = 70;
  const bw = W - 140;
  const bh = H - 140;
  ctx.fillStyle = "#fff1d6";
  ctx.beginPath();
  ctx.roundRect(bx, by, bw, bh, 60);
  ctx.fill();
  const scallop = 30;
  for (let x = bx + 60; x <= bx + bw - 60; x += scallop * 1.6) {
    for (const yy of [by, by + bh]) {
      ctx.beginPath();
      ctx.arc(x, yy, scallop, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  for (let y = by + 60; y <= by + bh - 60; y += scallop * 1.6) {
    for (const xx of [bx, bx + bw]) {
      ctx.beginPath();
      ctx.arc(xx, y, scallop, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  // A thin inner rule, like folded paper.
  ctx.strokeStyle = "rgba(170,90,20,.28)";
  ctx.lineWidth = 4;
  ctx.setLineDash([14, 12]);
  ctx.beginPath();
  ctx.roundRect(bx + 34, by + 34, bw - 68, bh - 68, 40);
  ctx.stroke();
  ctx.setLineDash([]);

  const fit = fitText(ctx, opts.words.trim(), (px) => `400 ${px}px ${fonts.hand}`, bw - 140, 3, 132, 70);
  ctx.font = `400 ${fit.px}px ${fonts.hand}`;
  ctx.fillStyle = "#7a2e0e";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const lh = fit.px * 1.08;
  let y = H / 2 - ((fit.lines.length - 1) * lh) / 2 - 30;
  for (const l of fit.lines) {
    ctx.fillText(l, W / 2, y);
    y += lh;
  }
  ctx.font = `400 64px ${fonts.hand}`;
  ctx.fillStyle = "#9a5a2a";
  ctx.fillText(`— ${opts.by}`, W / 2, y + 26);
  return toPng(dieCut(c.canvas));
}

/** A ring of up to 7 faces around the family's name. */
export async function treeBadge(opts: { familyName: string; faces: { name: string; photo: string | null }[] }): Promise<Blob | null> {
  const fonts = await cardFonts();
  const faces = opts.faces.slice(0, 7);
  const imgs = await Promise.all(faces.map((f) => loadImage(f.photo)));
  const S = 1000;
  const c = makeCanvas(S, S);
  if (!c) return null;
  const { ctx } = c;
  const cx = S / 2;
  const cy = S / 2;
  // The courtyard: a warm disc.
  ctx.beginPath();
  ctx.arc(cx, cy, 300, 0, Math.PI * 2);
  ctx.fillStyle = "#2f5684";
  ctx.fill();
  ctx.beginPath();
  ctx.arc(cx, cy, 282, 0, Math.PI * 2);
  ctx.strokeStyle = "rgba(255,214,144,.6)";
  ctx.lineWidth = 6;
  ctx.stroke();
  // Name in the middle.
  ctx.fillStyle = "#fff6e6";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `600 40px ${fonts.body}`;
  ctx.fillStyle = "rgba(255,226,170,.9)";
  ctx.fillText("THE", cx, cy - 78);
  const fit = fitText(ctx, opts.familyName, (px) => `400 ${px}px ${fonts.hand}`, 380, 2, 120, 60);
  ctx.font = `400 ${fit.px}px ${fonts.hand}`;
  ctx.fillStyle = "#fff6e6";
  const lh = fit.px * 1.0;
  let y = cy + 6 - ((fit.lines.length - 1) * lh) / 2;
  for (const l of fit.lines) {
    ctx.fillText(l, cx, y);
    y += lh;
  }
  ctx.font = `600 40px ${fonts.body}`;
  ctx.fillStyle = "rgba(255,226,170,.9)";
  ctx.fillText("FAMILY", cx, y + 30);
  // Faces around.
  const R = 330;
  const r = faces.length > 5 ? 108 : 120;
  faces.forEach((f, i) => {
    const a = -Math.PI / 2 + (i / Math.max(faces.length, 1)) * Math.PI * 2;
    const x = cx + Math.cos(a) * R;
    const yy = cy + Math.sin(a) * R;
    ctx.beginPath();
    ctx.arc(x, yy, r + 12, 0, Math.PI * 2);
    ctx.fillStyle = "#ffffff";
    ctx.fill();
    ctx.save();
    ctx.beginPath();
    ctx.arc(x, yy, r, 0, Math.PI * 2);
    ctx.clip();
    const img = imgs[i];
    if (img) drawCover(ctx, img, x - r, yy - r, r * 2, r * 2, 0.3);
    else {
      ctx.fillStyle = "#e9dfd1";
      ctx.fillRect(x - r, yy - r, r * 2, r * 2);
      ctx.fillStyle = "#7a6a58";
      ctx.font = `600 ${Math.round(r * 0.9)}px ${fonts.body}`;
      ctx.fillText(f.name.slice(0, 1).toUpperCase(), x, yy + 4);
    }
    ctx.restore();
  });
  return toPng(dieCut(c.canvas));
}

/** The lit diya, with "Thinking of you" underneath. */
export async function lampSticker(opts: { text?: string } = {}): Promise<Blob | null> {
  const fonts = await cardFonts();
  const W = 1000;
  const H = 1000;
  const c = makeCanvas(W, H);
  if (!c) return null;
  const { ctx } = c;
  const cx = W / 2;
  // Warm glow behind the flame (kept inside the outline).
  const glow = ctx.createRadialGradient(cx, 300, 10, cx, 300, 300);
  glow.addColorStop(0, "rgba(255,214,120,.95)");
  glow.addColorStop(0.5, "rgba(255,180,80,.55)");
  glow.addColorStop(1, "rgba(255,170,70,0)");
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(cx, 330, 290, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(cx, 330, 250, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(255,236,190,.9)";
  ctx.fill();
  // Flame: a teardrop.
  const fx = cx;
  const fy = 380;
  const flame = ctx.createLinearGradient(0, fy - 230, 0, fy);
  flame.addColorStop(0, "#ff9a1f");
  flame.addColorStop(0.55, "#ffc93c");
  flame.addColorStop(1, "#fff4c2");
  ctx.fillStyle = flame;
  ctx.beginPath();
  ctx.moveTo(fx, fy - 230);
  ctx.bezierCurveTo(fx + 30, fy - 150, fx + 85, fy - 90, fx + 70, fy - 30);
  ctx.bezierCurveTo(fx + 58, fy + 14, fx - 58, fy + 14, fx - 70, fy - 30);
  ctx.bezierCurveTo(fx - 85, fy - 90, fx - 30, fy - 150, fx, fy - 230);
  ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,.75)";
  ctx.beginPath();
  ctx.ellipse(fx, fy - 40, 22, 40, 0, 0, Math.PI * 2);
  ctx.fill();
  // The clay diya.
  const by = 430;
  const clay = ctx.createLinearGradient(0, by, 0, by + 190);
  clay.addColorStop(0, "#d0703a");
  clay.addColorStop(1, "#8a3a17");
  ctx.fillStyle = clay;
  ctx.beginPath();
  ctx.moveTo(cx - 290, by);
  ctx.quadraticCurveTo(cx - 250, by + 200, cx, by + 200);
  ctx.quadraticCurveTo(cx + 250, by + 200, cx + 330, by - 30);
  ctx.quadraticCurveTo(cx + 260, by + 10, cx + 200, by + 8);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#e89058";
  ctx.beginPath();
  ctx.ellipse(cx + 10, by + 6, 270, 34, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#6b2c10";
  ctx.beginPath();
  ctx.ellipse(cx + 10, by + 8, 230, 22, 0, 0, Math.PI * 2);
  ctx.fill();
  // Dots painted on the clay.
  ctx.fillStyle = "#ffd36b";
  for (let i = -3; i <= 3; i++) {
    ctx.beginPath();
    ctx.arc(cx + i * 62, by + 110 + Math.abs(i) * -8, 9, 0, Math.PI * 2);
    ctx.fill();
  }
  handLabel(ctx, fonts, opts.text?.trim() || "Thinking of you", cx, by + 220, W - 60, "#2a1d12");
  return toPng(dieCut(c.canvas));
}

/** A recipe with no photo yet: its name, handwritten on a plate. */
export async function plateSticker(label: string): Promise<Blob | null> {
  const fonts = await cardFonts();
  const c = makeCanvas(900, 900);
  if (!c) return null;
  const { ctx } = c;
  ctx.beginPath();
  ctx.arc(450, 450, 430, 0, Math.PI * 2);
  ctx.fillStyle = "#fbefd9";
  ctx.fill();
  ctx.beginPath();
  ctx.arc(450, 450, 360, 0, Math.PI * 2);
  ctx.strokeStyle = "#f2a516";
  ctx.lineWidth = 10;
  ctx.stroke();
  const fit = fitText(ctx, label.trim() || "From our kitchen", (px) => `400 ${px}px ${fonts.hand}`, 600, 3, 120, 60);
  ctx.font = `400 ${fit.px}px ${fonts.hand}`;
  ctx.fillStyle = "#2a1d12";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  let y = 450 - ((fit.lines.length - 1) * fit.px) / 2;
  for (const l of fit.lines) {
    ctx.fillText(l, 450, y);
    y += fit.px;
  }
  return toPng(dieCut(c.canvas));
}

/** A transcript's words, for picking a few by tapping (first 80). */
export function transcriptWords(text: string): string[] {
  return text
    .replace(/[“”"]/g, "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 80);
}

/** Clamp free text to at most `max` words (the blessing sticker's limit). */
export function clampWords(text: string, max = 6): string {
  return text.trim().split(/\s+/).filter(Boolean).slice(0, max).join(" ");
}
