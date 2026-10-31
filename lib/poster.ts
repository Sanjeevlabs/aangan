// Draw a family constellation (or a recipe) as a PNG on a canvas, in the
// browser, from data we already have. No server, no third party: the image
// never leaves the device unless the person shares it.
import { CARD_H, CARD_W, cardFonts, drawCover, drawFooter, fitText, loadImage, makeCanvas, toPng, wrap } from "./card-kit";
import type { Constellation } from "./constellation";

export interface PosterPerson {
  id: string;
  name: string;
  label: string;
  photo: string | null;
  ring: string;
}

function initials(name: string): string {
  return name.trim().slice(0, 1).toUpperCase();
}

/** 1080×1350 (4:5, fits every feed and WhatsApp status). */
export async function constellationPoster(c: Constellation, people: Map<string, PosterPerson>, title: string, subtitle: string): Promise<Blob | null> {
  const W = CARD_W;
  const H = CARD_H;
  const made = makeCanvas(W, H);
  if (!made) return null;
  const { canvas, ctx } = made;
  const fonts = await cardFonts();
  ctx.fillStyle = "#fffaf2";
  ctx.fillRect(0, 0, W, H);
  const glow = ctx.createRadialGradient(W / 2, H * 0.55, 20, W / 2, H * 0.55, 520);
  glow.addColorStop(0, "rgba(242,165,22,.18)");
  glow.addColorStop(1, "rgba(242,165,22,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  ctx.fillStyle = "#111";
  ctx.textAlign = "center";
  const t = fitText(ctx, title, (px) => `700 ${px}px ${fonts.body}`, W - 160, 1, 64, 40);
  ctx.font = `700 ${t.px}px ${fonts.body}`;
  ctx.fillText(t.lines[0] ?? title, W / 2, 120);
  ctx.fillStyle = "#6b6b6b";
  ctx.font = `500 34px ${fonts.body}`;
  ctx.fillText(subtitle, W / 2, 175);

  // Fit the constellation into the area below the title.
  const pad = 110;
  const bw = c.bounds.maxX - c.bounds.minX || 1;
  const bh = c.bounds.maxY - c.bounds.minY || 1;
  const areaTop = 230 + pad * 0.5;
  const areaH = H - areaTop - 190;
  const scale = Math.min((W - pad * 2) / bw, areaH / bh, 1.9);
  const ox = W / 2 - ((c.bounds.minX + c.bounds.maxX) / 2) * scale;
  const oy = areaTop + (areaH - bh * scale) / 2 - c.bounds.minY * scale;
  const at = (id: string) => {
    const n = c.nodes.find((x) => x.id === id);
    return n ? { x: ox + n.x * scale, y: oy + n.y * scale, n } : null;
  };

  ctx.lineCap = "round";
  for (const l of c.links) {
    const a = at(l.from);
    const b = at(l.to);
    if (!a || !b) continue;
    ctx.strokeStyle = l.kind === "spouse" ? "#f2a516" : "rgba(0,0,0,.18)";
    ctx.lineWidth = l.kind === "spouse" ? 6 : 4;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }

  const imgs = await Promise.all(c.nodes.map(async (n) => [n.id, await loadImage(people.get(n.id)?.photo)] as const));
  const imgOf = new Map(imgs);
  for (const n of c.nodes) {
    const p = people.get(n.id);
    const pos = at(n.id);
    if (!p || !pos) continue;
    const r = n.depth === 0 ? 74 : n.depth === 1 ? 54 : 46;
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, r + 9, 0, Math.PI * 2);
    ctx.fillStyle = n.depth === 0 ? "#111" : p.ring;
    ctx.fill();
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, r + 4, 0, Math.PI * 2);
    ctx.fillStyle = "#fff";
    ctx.fill();
    ctx.save();
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, r, 0, Math.PI * 2);
    ctx.clip();
    const img = imgOf.get(n.id);
    if (img) {
      drawCover(ctx, img, pos.x - r, pos.y - r, r * 2, r * 2, 0.3);
    } else {
      ctx.fillStyle = "#e9dfd1";
      ctx.fillRect(pos.x - r, pos.y - r, r * 2, r * 2);
      ctx.fillStyle = "#7a6a58";
      ctx.font = `600 ${Math.round(r * 0.9)}px ${fonts.body}`;
      ctx.textBaseline = "middle";
      ctx.fillText(initials(p.name), pos.x, pos.y + 2);
      ctx.textBaseline = "alphabetic";
    }
    ctx.restore();
    ctx.fillStyle = "#111";
    ctx.font = `700 ${n.depth === 0 ? 34 : 28}px ${fonts.body}`;
    ctx.fillText(p.name, pos.x, pos.y + r + 44);
    if (p.label) {
      ctx.fillStyle = "#7a7a7a";
      ctx.font = `500 22px ${fonts.body}`;
      ctx.fillText(p.label, pos.x, pos.y + r + 74);
    }
  }

  await drawFooter(ctx, fonts);
  return toPng(canvas);
}

/** Share a file if the device can; otherwise download it. Returns what happened. */
export async function shareOrDownload(blob: Blob, filename: string, text: string): Promise<"shared" | "downloaded" | "cancelled"> {
  const file = new File([blob], filename, { type: blob.type });
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  if (nav.share && nav.canShare?.({ files: [file] })) {
    try {
      await nav.share({ files: [file], text });
      return "shared";
    } catch {
      return "cancelled";
    }
  }
  downloadBlob(blob, filename);
  return "downloaded";
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

export interface CardRecipe {
  title: string;
  from: string;
  meta: string;
  memory: string;
  ingredients: { item: string; said: string; approx: string }[];
  accent: string;
  bg: string;
  ink: string;
  /** The dish, when the family has a photo of it. */
  photo?: string | null;
}

/** A recipe as a shareable 4:5 card: name, whose it is, ingredients, the link. */
export async function recipeCardImage(r: CardRecipe, link: string | null): Promise<Blob | null> {
  const W = CARD_W;
  const H = CARD_H;
  const made = makeCanvas(W, H);
  if (!made) return null;
  const { canvas, ctx } = made;
  const [fonts, dish] = await Promise.all([cardFonts(), loadImage(r.photo ?? null)]);
  ctx.fillStyle = r.bg;
  ctx.fillRect(0, 0, W, H);
  const x = 90;
  if (dish) {
    // The dish in a plate-sized circle, top right.
    const cr = 190;
    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,.22)";
    ctx.shadowBlur = 40;
    ctx.shadowOffsetY = 16;
    ctx.beginPath();
    ctx.arc(W - 70 - cr, 70 + cr, cr + 12, 0, Math.PI * 2);
    ctx.fillStyle = "#fff";
    ctx.fill();
    ctx.restore();
    ctx.save();
    ctx.beginPath();
    ctx.arc(W - 70 - cr, 70 + cr, cr, 0, Math.PI * 2);
    ctx.clip();
    drawCover(ctx, dish, W - 70 - cr * 2, 70, cr * 2, cr * 2, 0.5);
    ctx.restore();
  } else {
    ctx.fillStyle = r.accent;
    ctx.globalAlpha = 0.16;
    ctx.beginPath();
    ctx.arc(W - 120, 140, 260, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  const textW = dish ? W - 180 - 400 : W - 180;
  ctx.textAlign = "left";
  ctx.fillStyle = r.ink;
  ctx.font = `700 30px ${fonts.body}`;
  ctx.fillText(r.meta.toUpperCase(), x, 150);
  ctx.fillStyle = "#111";
  const t = fitText(ctx, r.title, (px) => `700 ${px}px ${fonts.body}`, textW, 3, 84, 56);
  ctx.font = `700 ${t.px}px ${fonts.body}`;
  let y = 150 + t.px * 1.15;
  for (const l of t.lines) {
    ctx.fillText(l, x, y);
    y += t.px * 1.1;
  }
  ctx.fillStyle = "#555";
  ctx.font = `400 44px ${fonts.hand}`;
  ctx.fillText(`From ${r.from}'s kitchen`, x, y + 6);
  y = Math.max(y + 60, dish ? 520 : 0);
  if (r.memory) {
    ctx.fillStyle = r.ink;
    ctx.font = `italic 400 38px ${fonts.voice}`;
    for (const l of wrap(ctx, `“${r.memory}”`, W - 180).slice(0, 3)) {
      y += 52;
      ctx.fillText(l, x, y);
    }
    y += 30;
  }
  // Ingredients panel, sized to what's left above the footer.
  const top = y + 30;
  const room = H - 190 - top - (link ? 40 : 0);
  const fitRows = Math.max(2, Math.floor((room - 110) / 58));
  const rows = r.ingredients.slice(0, Math.min(9, fitRows));
  const more = r.ingredients.length - rows.length;
  const panelH = 90 + rows.length * 58 + (more > 0 ? 50 : 0);
  ctx.fillStyle = "rgba(255,255,255,.78)";
  ctx.beginPath();
  ctx.roundRect(x - 20, top, W - 140, panelH, 36);
  ctx.fill();
  ctx.fillStyle = "#111";
  ctx.font = `700 36px ${fonts.body}`;
  ctx.fillText("Ingredients", x + 20, top + 64);
  let ry = top + 64;
  for (const i of rows) {
    ry += 58;
    ctx.fillStyle = r.accent;
    ctx.beginPath();
    ctx.arc(x + 30, ry - 11, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#222";
    ctx.font = `600 32px ${fonts.body}`;
    ctx.fillText(i.item.slice(0, 30), x + 56, ry);
    const amt = i.said || i.approx;
    if (amt) {
      ctx.textAlign = "right";
      ctx.fillStyle = "#666";
      ctx.font = `italic 400 30px ${fonts.voice}`;
      ctx.fillText(amt.slice(0, 24), W - 110, ry);
      ctx.textAlign = "left";
    }
  }
  if (more > 0) {
    ctx.fillStyle = "#777";
    ctx.font = `500 28px ${fonts.body}`;
    ctx.fillText(`+ ${more} more`, x + 56, ry + 50);
  }
  if (link) {
    ctx.fillStyle = "#555";
    ctx.font = `500 26px ${fonts.body}`;
    ctx.textAlign = "center";
    ctx.fillText(`Full recipe: ${link.replace(/^https?:\/\//, "")}`, W / 2, H - 150);
  }
  await drawFooter(ctx, fonts);
  return toPng(canvas);
}
