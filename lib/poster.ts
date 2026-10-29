// Draw a family constellation (or any card) as a PNG on a canvas, in the
// browser, from data we already have. No server, no third party: the image
// never leaves the device unless the person shares it.
import type { Constellation } from "./constellation";

export interface PosterPerson {
  id: string;
  name: string;
  label: string;
  photo: string | null;
  ring: string;
}

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

function initials(name: string): string {
  return name.trim().slice(0, 1).toUpperCase();
}

/** 1080×1350 (4:5, fits every feed and WhatsApp status). */
export async function constellationPoster(c: Constellation, people: Map<string, PosterPerson>, title: string, subtitle: string): Promise<Blob | null> {
  const W = 1080;
  const H = 1350;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.fillStyle = "#fffaf2";
  ctx.fillRect(0, 0, W, H);
  const glow = ctx.createRadialGradient(W / 2, H * 0.55, 20, W / 2, H * 0.55, 520);
  glow.addColorStop(0, "rgba(242,165,22,.18)");
  glow.addColorStop(1, "rgba(242,165,22,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  ctx.fillStyle = "#111";
  ctx.font = "700 64px Onest, system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(title, W / 2, 120);
  ctx.fillStyle = "#6b6b6b";
  ctx.font = "500 34px Onest, system-ui, sans-serif";
  ctx.fillText(subtitle, W / 2, 175);

  // Fit the constellation into the area below the title.
  const pad = 110;
  const bw = c.bounds.maxX - c.bounds.minX || 1;
  const bh = c.bounds.maxY - c.bounds.minY || 1;
  const areaTop = 230 + pad * 0.5;
  const areaH = H - areaTop - 150;
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

  const imgs = await Promise.all(c.nodes.map(async (n) => [n.id, people.get(n.id)?.photo ? await loadImage(people.get(n.id)?.photo as string) : null] as const));
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
      const s = Math.max((r * 2) / img.width, (r * 2) / img.height);
      ctx.drawImage(img, pos.x - (img.width * s) / 2, pos.y - (img.height * s) / 2.6, img.width * s, img.height * s);
    } else {
      ctx.fillStyle = "#e9dfd1";
      ctx.fillRect(pos.x - r, pos.y - r, r * 2, r * 2);
      ctx.fillStyle = "#7a6a58";
      ctx.font = `600 ${Math.round(r * 0.9)}px Onest, system-ui, sans-serif`;
      ctx.textBaseline = "middle";
      ctx.fillText(initials(p.name), pos.x, pos.y + 2);
      ctx.textBaseline = "alphabetic";
    }
    ctx.restore();
    ctx.fillStyle = "#111";
    ctx.font = `700 ${n.depth === 0 ? 34 : 28}px Onest, system-ui, sans-serif`;
    ctx.fillText(p.name, pos.x, pos.y + r + 44);
    if (p.label) {
      ctx.fillStyle = "#7a7a7a";
      ctx.font = "500 22px Onest, system-ui, sans-serif";
      ctx.fillText(p.label, pos.x, pos.y + r + 74);
    }
  }

  // Quiet mark: the open courtyard and a marigold.
  ctx.strokeStyle = "#111";
  ctx.lineWidth = 5;
  ctx.strokeRect(W / 2 - 92, H - 78, 30, 30);
  ctx.beginPath();
  ctx.arc(W / 2 - 77, H - 63, 6, 0, Math.PI * 2);
  ctx.fillStyle = "#f2a516";
  ctx.fill();
  ctx.fillStyle = "#111";
  ctx.font = "700 30px Onest, system-ui, sans-serif";
  ctx.textAlign = "left";
  ctx.fillText("Aangan", W / 2 - 50, H - 52);
  return await new Promise((resolve) => canvas.toBlob((b) => resolve(b), "image/png"));
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
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  return "downloaded";
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
}

function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    const next = line ? `${line} ${w}` : w;
    if (ctx.measureText(next).width > maxWidth && line) {
      lines.push(line);
      line = w;
    } else line = next;
  }
  if (line) lines.push(line);
  return lines;
}

/** A recipe as a shareable 4:5 card: name, whose it is, ingredients, the link. */
export async function recipeCardImage(r: CardRecipe, link: string | null): Promise<Blob | null> {
  const W = 1080;
  const H = 1350;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.fillStyle = r.bg;
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = r.accent;
  ctx.globalAlpha = 0.16;
  ctx.beginPath();
  ctx.arc(W - 120, 140, 260, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;

  const x = 90;
  ctx.textAlign = "left";
  ctx.fillStyle = r.ink;
  ctx.font = "700 30px Onest, system-ui, sans-serif";
  ctx.fillText(r.meta.toUpperCase(), x, 150);
  ctx.fillStyle = "#111";
  ctx.font = "700 84px Onest, system-ui, sans-serif";
  let y = 250;
  for (const l of wrap(ctx, r.title, W - 180).slice(0, 2)) {
    ctx.fillText(l, x, y);
    y += 92;
  }
  ctx.fillStyle = "#555";
  ctx.font = "500 36px Onest, system-ui, sans-serif";
  ctx.fillText(`From ${r.from}'s kitchen`, x, y + 6);
  y += 70;
  if (r.memory) {
    ctx.fillStyle = r.ink;
    ctx.font = "italic 400 38px Literata, Georgia, serif";
    for (const l of wrap(ctx, `“${r.memory}”`, W - 180).slice(0, 3)) {
      y += 52;
      ctx.fillText(l, x, y);
    }
    y += 30;
  }
  // Ingredients panel.
  const top = y + 30;
  const rows = r.ingredients.slice(0, 9);
  const panelH = 90 + rows.length * 58 + (r.ingredients.length > rows.length ? 50 : 0);
  ctx.fillStyle = "rgba(255,255,255,.78)";
  ctx.beginPath();
  ctx.roundRect(x - 20, top, W - 140, panelH, 36);
  ctx.fill();
  ctx.fillStyle = "#111";
  ctx.font = "700 36px Onest, system-ui, sans-serif";
  ctx.fillText("Ingredients", x + 20, top + 64);
  let ry = top + 64;
  for (const i of rows) {
    ry += 58;
    ctx.fillStyle = r.accent;
    ctx.beginPath();
    ctx.arc(x + 30, ry - 11, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#222";
    ctx.font = "600 32px Onest, system-ui, sans-serif";
    ctx.fillText(i.item.slice(0, 30), x + 56, ry);
    const amt = i.said || i.approx;
    if (amt) {
      ctx.textAlign = "right";
      ctx.fillStyle = "#666";
      ctx.font = "italic 400 30px Literata, Georgia, serif";
      ctx.fillText(amt.slice(0, 24), W - 110, ry);
      ctx.textAlign = "left";
    }
  }
  if (r.ingredients.length > rows.length) {
    ctx.fillStyle = "#777";
    ctx.font = "500 28px Onest, system-ui, sans-serif";
    ctx.fillText(`+ ${r.ingredients.length - rows.length} more`, x + 56, ry + 50);
  }
  // Footer: the mark, and where the full recipe lives.
  ctx.strokeStyle = "#111";
  ctx.lineWidth = 5;
  ctx.strokeRect(x, H - 120, 30, 30);
  ctx.beginPath();
  ctx.arc(x + 15, H - 105, 6, 0, Math.PI * 2);
  ctx.fillStyle = "#f2a516";
  ctx.fill();
  ctx.fillStyle = "#111";
  ctx.font = "700 30px Onest, system-ui, sans-serif";
  ctx.fillText("Aangan", x + 46, H - 94);
  if (link) {
    ctx.fillStyle = "#555";
    ctx.font = "500 26px Onest, system-ui, sans-serif";
    ctx.fillText(`Full recipe: ${link.replace(/^https?:\/\//, "")}`, x, H - 48);
  }
  return await new Promise((resolve) => canvas.toBlob((b) => resolve(b), "image/png"));
}
