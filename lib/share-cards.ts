// Shareable cards, drawn in the browser to a 1080×1350 PNG (4:5: WhatsApp,
// an Instagram post, or a story when centred). Everything is drawn from what
// the screen already has; nothing is uploaded to draw it. Every card carries
// the same small footer (lib/card-kit.ts). Who may share which card lives in
// lib/share-rules.ts. The recipe card and the family-tree poster live in
// lib/poster.ts and are re-exported here so screens have one door.
import { CARD_H, CARD_W, cardDate, cardFonts, drawCover, drawFooter, fitText, loadImage, makeCanvas, toPng, wrap } from "./card-kit";

export { constellationPoster as treeCard, recipeCardImage as recipeCard } from "./poster";

const PAPER_TOP = "#fffdf8";
const PAPER_BOTTOM = "#f8f3e9";

/* ------------------------------------------------------------ photo print */

export interface PrintCardInput {
  src: string;
  note: string;
  /** "Sat, 26 Oct · 7:40 AM" */
  when: string;
  where: string;
  /** "Maa": signs the note, as the print does. */
  by: string;
}

/**
 * The photo as a print, like components/print-frame.tsx: a white border,
 * thicker at the bottom, the note and when/where in the sharer's hand.
 */
export async function photoPrintCard(p: PrintCardInput): Promise<Blob | null> {
  const c = makeCanvas(CARD_W, CARD_H);
  if (!c) return null;
  const { canvas, ctx } = c;
  const [fonts, img] = await Promise.all([cardFonts(), loadImage(p.src)]);
  if (!img) return null;

  // A warm table under the print: the photo's own colour, blurred and dimmed.
  ctx.fillStyle = "#e9e1d4";
  ctx.fillRect(0, 0, CARD_W, CARD_H);
  ctx.save();
  ctx.filter = "blur(60px) saturate(1.1) brightness(.92)";
  drawCover(ctx, img, -120, -120, CARD_W + 240, CARD_H + 240, 0.5);
  ctx.restore();
  ctx.fillStyle = "rgba(255,250,242,.38)";
  ctx.fillRect(0, 0, CARD_W, CARD_H);

  // The print.
  const pw = 820;
  const pad = 34;
  const iw = pw - pad * 2;
  const ih = Math.round(iw * 1.2); // 4:5, as on screen
  const hand = (px: number) => `400 ${px}px ${fonts.hand}`;
  const sign = p.by && p.note ? ` — ${p.by}` : "";
  const noteFit = p.note ? fitText(ctx, `${p.note}${sign}`, hand, iw - 8, 2, 46, 34) : { px: 0, lines: [] as string[] };
  const meta = [p.when, p.where].filter(Boolean).join(" · ");
  const capH = 26 + noteFit.lines.length * noteFit.px * 1.22 + (meta ? 48 : 0) + 30;
  const ph = pad + ih + capH;
  const px = (CARD_W - pw) / 2;
  const py = Math.max(70, (CARD_H - 150 - ph) / 2);

  ctx.save();
  ctx.translate(CARD_W / 2, py + ph / 2);
  ctx.rotate(-0.012);
  ctx.translate(-CARD_W / 2, -(py + ph / 2));
  ctx.shadowColor = "rgba(0,0,0,.28)";
  ctx.shadowBlur = 50;
  ctx.shadowOffsetY = 22;
  const paper = ctx.createLinearGradient(0, py, 0, py + ph);
  paper.addColorStop(0, PAPER_TOP);
  paper.addColorStop(1, PAPER_BOTTOM);
  ctx.fillStyle = paper;
  ctx.fillRect(px, py, pw, ph);
  ctx.shadowColor = "transparent";
  ctx.fillStyle = "#ebe5d8";
  ctx.fillRect(px + pad, py + pad, iw, ih);
  ctx.save();
  ctx.beginPath();
  ctx.rect(px + pad, py + pad, iw, ih);
  ctx.clip();
  drawCover(ctx, img, px + pad, py + pad, iw, ih, 0.3);
  ctx.restore();
  ctx.strokeStyle = "rgba(0,0,0,.07)";
  ctx.lineWidth = 2;
  ctx.strokeRect(px + pad + 1, py + pad + 1, iw - 2, ih - 2);

  let y = py + pad + ih + 26;
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  if (noteFit.lines.length) {
    ctx.font = hand(noteFit.px);
    ctx.fillStyle = "#25201c";
    for (const l of noteFit.lines) {
      ctx.fillText(l, px + pad + 4, y);
      y += noteFit.px * 1.22;
    }
  }
  if (meta) {
    ctx.font = hand(32);
    ctx.fillStyle = "#4a413a";
    ctx.fillText(meta, px + pad + 4, y + 8);
  }
  ctx.restore();

  await drawFooter(ctx, fonts);
  return toPng(canvas);
}

/* ---------------------------------------------------------------- occasion */

export interface OccasionCardInput {
  /** "Wishes for Maa's birthday" */
  title: string;
  /** The occasion photo (the celebrant's portrait, or the family). */
  photo: string | null;
  wishers: { name: string; photo: string | null }[];
  /** "6 of us wished Maa" */
  line: string;
  date: string;
}

export async function occasionCard(o: OccasionCardInput): Promise<Blob | null> {
  const c = makeCanvas(CARD_W, CARD_H);
  if (!c) return null;
  const { canvas, ctx } = c;
  const [fonts, img, faces] = await Promise.all([cardFonts(), loadImage(o.photo), Promise.all(o.wishers.slice(0, 12).map((w) => loadImage(w.photo)))]);

  ctx.fillStyle = "#14110e";
  ctx.fillRect(0, 0, CARD_W, CARD_H);
  // The photo fills the top, fading into the night below.
  const photoH = 860;
  if (img) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, CARD_W, photoH);
    ctx.clip();
    drawCover(ctx, img, 0, 0, CARD_W, photoH, 0.3);
    ctx.restore();
  }
  const fade = ctx.createLinearGradient(0, photoH * 0.45, 0, photoH);
  fade.addColorStop(0, "rgba(20,17,14,0)");
  fade.addColorStop(1, "rgba(20,17,14,1)");
  ctx.fillStyle = fade;
  ctx.fillRect(0, 0, CARD_W, photoH);
  // A few marigold sparks.
  for (const [x, y, r] of [[140, 140, 7], [930, 210, 9], [820, 90, 5], [220, 330, 5], [980, 420, 6]] as const) {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255,200,90,.85)";
    ctx.fill();
  }

  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  const t = fitText(ctx, o.title, (px) => `700 ${px}px ${fonts.body}`, CARD_W - 160, 2, 76, 52);
  ctx.font = `700 ${t.px}px ${fonts.body}`;
  ctx.fillStyle = "#fff";
  let y = photoH - 40 - (t.lines.length - 1) * t.px * 1.1;
  for (const l of t.lines) {
    ctx.fillText(l, CARD_W / 2, y);
    y += t.px * 1.1;
  }
  if (o.date) {
    ctx.font = `400 40px ${fonts.hand}`;
    ctx.fillStyle = "rgba(255,226,170,.95)";
    ctx.fillText(o.date, CARD_W / 2, y + 16);
  }

  // The wishers: overlapping faces, centred.
  const n = faces.length;
  if (n > 0) {
    const r = n > 8 ? 46 : 56;
    const step = r * 1.45;
    const rowW = step * (n - 1) + r * 2;
    let x = (CARD_W - rowW) / 2 + r;
    const cy = 1060;
    o.wishers.slice(0, 12).forEach((w, i) => {
      ctx.beginPath();
      ctx.arc(x, cy, r + 6, 0, Math.PI * 2);
      ctx.fillStyle = "#14110e";
      ctx.fill();
      ctx.save();
      ctx.beginPath();
      ctx.arc(x, cy, r, 0, Math.PI * 2);
      ctx.clip();
      const f = faces[i];
      if (f) drawCover(ctx, f, x - r, cy - r, r * 2, r * 2, 0.3);
      else {
        ctx.fillStyle = "#3a3028";
        ctx.fillRect(x - r, cy - r, r * 2, r * 2);
        ctx.fillStyle = "#f3e6d3";
        ctx.font = `600 ${Math.round(r * 0.9)}px ${fonts.body}`;
        ctx.textBaseline = "middle";
        ctx.fillText(w.name.slice(0, 1).toUpperCase(), x, cy + 2);
        ctx.textBaseline = "alphabetic";
      }
      ctx.restore();
      x += step;
    });
    ctx.font = `500 34px ${fonts.body}`;
    ctx.fillStyle = "rgba(255,255,255,.78)";
    ctx.textAlign = "center";
    ctx.fillText(o.line, CARD_W / 2, cy + r + 66);
  }

  await drawFooter(ctx, fonts, { tone: "dark" });
  return toPng(canvas);
}

/* ------------------------------------------------------------------- quote */

export interface QuoteCardInput {
  words: string;
  /** "Maa" */
  by: string;
  /** ISO date it was said. */
  at: string;
  tz?: string | null;
  /** A quiet line above: "On raising children", "A blessing", "A story". */
  context?: string;
  photo?: string | null;
}

/** Words someone said, in the Kalam hand, signed "— Maa" with the date. */
export async function quoteCard(q: QuoteCardInput): Promise<Blob | null> {
  const c = makeCanvas(CARD_W, CARD_H);
  if (!c) return null;
  const { canvas, ctx } = c;
  const [fonts, face] = await Promise.all([cardFonts(), loadImage(q.photo ?? null)]);

  const bg = ctx.createLinearGradient(0, 0, 0, CARD_H);
  bg.addColorStop(0, "#fbf5ea");
  bg.addColorStop(1, "#f2e8d8");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, CARD_W, CARD_H);
  // Faint ruled lines, like a page from a notebook.
  ctx.strokeStyle = "rgba(47,86,132,.08)";
  ctx.lineWidth = 2;
  for (let ly = 260; ly < CARD_H - 200; ly += 74) {
    ctx.beginPath();
    ctx.moveTo(90, ly);
    ctx.lineTo(CARD_W - 90, ly);
    ctx.stroke();
  }

  const x = 120;
  const maxW = CARD_W - 240;
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  if (q.context) {
    ctx.font = `600 30px ${fonts.body}`;
    ctx.fillStyle = "#8a5a12";
    ctx.fillText(q.context.toUpperCase(), x, 200);
  }
  ctx.font = `400 220px ${fonts.voice}`;
  ctx.fillStyle = "rgba(242,165,22,.55)";
  ctx.fillText("“", x - 24, 400);

  const words = q.words.trim().replace(/\s+/g, " ");
  // The words get the room between the quote mark and the signature (300…1040).
  const ROOM = 740;
  let fit: { px: number; lines: string[] } | null = null;
  for (let px = 84; px >= 40 && !fit; px -= 2) {
    ctx.font = `400 ${px}px ${fonts.hand}`;
    const lines = wrap(ctx, words, maxW);
    if (lines.length * px * 1.28 <= ROOM) fit = { px, lines };
  }
  fit ??= fitText(ctx, words, (px) => `400 ${px}px ${fonts.hand}`, maxW, Math.floor(ROOM / (40 * 1.28)), 40, 40);
  const lh = fit.px * 1.28;
  const blockH = fit.lines.length * lh;
  let y = 300 + Math.max(0, (ROOM - blockH) / 2) + fit.px * 0.9;
  ctx.font = `400 ${fit.px}px ${fonts.hand}`;
  ctx.fillStyle = "#25201c";
  for (const l of fit.lines) {
    ctx.fillText(l, x, y);
    y += lh;
  }

  // Signature: a small face, "— Maa", and the day it was said.
  y += 40;
  let sx = x;
  if (face) {
    const r = 40;
    ctx.save();
    ctx.beginPath();
    ctx.arc(x + r, y - 14, r, 0, Math.PI * 2);
    ctx.clip();
    drawCover(ctx, face, x, y - 14 - r, r * 2, r * 2, 0.3);
    ctx.restore();
    sx = x + r * 2 + 22;
  }
  ctx.font = `400 52px ${fonts.hand}`;
  ctx.fillStyle = "#4a413a";
  ctx.fillText(`— ${q.by}`, sx, y);
  const date = cardDate(q.at, q.tz);
  if (date) {
    ctx.font = `500 28px ${fonts.body}`;
    ctx.fillStyle = "rgba(74,65,58,.7)";
    ctx.fillText(date, sx, y + 44);
  }

  await drawFooter(ctx, fonts);
  return toPng(canvas);
}

/** The first sentence or two of a transcript, for a quote card. */
export function quoteFrom(text: string, max = 260): string {
  const t = text.trim().replace(/\s+/g, " ");
  if (t.length <= max) return t;
  const cut = t.slice(0, max);
  const end = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf("? "), cut.lastIndexOf("! "), cut.lastIndexOf("। "));
  return end > max * 0.4 ? cut.slice(0, end + 1) : `${cut.replace(/\s+\S*$/, "")}…`;
}

