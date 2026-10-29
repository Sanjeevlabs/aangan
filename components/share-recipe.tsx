"use client";

import { AnimatePresence, m } from "framer-motion";
import { useState } from "react";
import type { Recipe } from "@/lib/kinds";
import { recipeCardImage, shareOrDownload } from "@/lib/poster";
import { postJson, useJson } from "@/lib/use-json";
import { COURSE_LOOK, totalTime } from "./recipe-art";
import { Icon } from "./ui/kit";

interface ShareInfo {
  token: string;
  refId: string;
  views: number;
}

/**
 * Share one recipe beyond the family: a link anyone can open (a frozen copy,
 * revocable), straight to WhatsApp, as an image card, or as plain text.
 */
export function ShareRecipe({ recipe, cookName }: { recipe: Recipe; cookName: string }) {
  const [open, setOpen] = useState(false);
  const shares = useJson<{ shares: ShareInfo[] }>(open ? "/api/share" : null);
  const existing = shares.data?.shares.find((s) => s.refId === recipe.id);
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const look = COURSE_LOOK[recipe.course] ?? COURSE_LOOK.other;

  const link = async (): Promise<string | null> => {
    if (existing) return `${location.origin}/r/${existing.token}`;
    const out = await postJson<{ path: string }>("/api/share", { kind: "recipe", id: recipe.id });
    void shares.reload();
    return out ? `${location.origin}${out.path}` : null;
  };
  const text = (url: string | null) =>
    [`${recipe.title} — from ${cookName}'s kitchen`, recipe.memory ? `“${recipe.memory}”` : "", "", "Ingredients:", ...recipe.ingredients.map((i) => `• ${i.item}${i.said || i.approx ? ` — ${i.said || i.approx}` : ""}`), "", "Method:", ...recipe.steps.map((s, n) => `${n + 1}. ${s.text}`), url ? `\nFull recipe: ${url}` : ""]
      .filter((l, i, a) => !(l === "" && a[i - 1] === ""))
      .join("\n");
  const run = async (key: string, fn: () => Promise<void>) => {
    setBusy(key);
    setNote(null);
    try {
      await fn();
    } finally {
      setBusy(null);
    }
  };

  const actions: { key: string; label: string; sub: string; onClick: () => Promise<void> }[] = [
    {
      key: "whatsapp",
      label: "Send on WhatsApp",
      sub: "To a group or a friend",
      onClick: async () => {
        const url = await link();
        if (!url) return setNote("Couldn't make a link. Try again.");
        window.open(`https://wa.me/?text=${encodeURIComponent(`${recipe.title}, from ${cookName}'s kitchen 🍲\n${url}`)}`, "_blank", "noopener");
      },
    },
    {
      key: "link",
      label: "Share the link",
      sub: "Anyone with it can read the recipe",
      onClick: async () => {
        const url = await link();
        if (!url) return setNote("Couldn't make a link. Try again.");
        const nav = navigator as Navigator;
        if (nav.share) {
          await nav.share({ title: recipe.title, text: `${recipe.title}, from ${cookName}'s kitchen`, url }).catch(() => undefined);
        } else {
          await navigator.clipboard.writeText(url).catch(() => undefined);
          setNote("Link copied.");
        }
      },
    },
    {
      key: "image",
      label: "Share as an image",
      sub: "A card for Instagram, status or print",
      onClick: async () => {
        const url = await link();
        const blob = await recipeCardImage({ title: recipe.title, from: cookName, meta: [look.label, totalTime(recipe)].filter(Boolean).join(" · "), memory: recipe.memory, ingredients: recipe.ingredients, accent: look.accent, bg: look.bg, ink: look.ink }, url);
        if (!blob) return setNote("Couldn't draw the card.");
        const how = await shareOrDownload(blob, `${recipe.title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.png`, `${recipe.title}, from ${cookName}'s kitchen`);
        if (how === "downloaded") setNote("Saved to your downloads.");
      },
    },
    {
      key: "text",
      label: "Copy as text",
      sub: "Paste anywhere, even without the link",
      onClick: async () => {
        const url = existing ? `${location.origin}/r/${existing.token}` : null;
        await navigator.clipboard.writeText(text(url)).catch(() => undefined);
        setNote("Recipe copied.");
      },
    },
  ];

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="press flex h-11 items-center gap-1.5 rounded-full bg-surface px-4 text-[15px] font-semibold">
        <Icon name="send" size={16} />
        Share
      </button>
      <AnimatePresence>
        {open && (
          <div className="fixed inset-0 z-50 flex items-end justify-center" role="dialog" aria-modal="true" aria-label={`Share ${recipe.title}`}>
            <m.button type="button" aria-label="Close" className="absolute inset-0 bg-black/25" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setOpen(false)} />
            <m.div className="relative w-full max-w-[480px] rounded-t-[32px] bg-white px-5 pt-3 shadow-frost" style={{ paddingBottom: "calc(20px + env(safe-area-inset-bottom))" }} initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: "spring", stiffness: 340, damping: 36 }}>
              <span className="mx-auto mb-3 block h-1.5 w-10 rounded-full bg-black/15" aria-hidden="true" />
              <p className="m-0 text-[20px] font-semibold">Share {recipe.title}</p>
              <p className="m-0 mt-1 text-[14px] text-ink-soft">Others see the recipe and that it&rsquo;s {cookName}&rsquo;s. Never your family, voices or photos.</p>
              <ul className="m-0 mt-4 list-none space-y-2 p-0">
                {actions.map((a) => (
                  <li key={a.key}>
                    <button type="button" disabled={Boolean(busy)} onClick={() => void run(a.key, a.onClick)} className="press flex w-full items-center justify-between gap-3 rounded-[18px] bg-surface px-4 py-3 text-left disabled:opacity-60">
                      <span>
                        <span className="block text-[16px] font-semibold">{busy === a.key ? "One moment…" : a.label}</span>
                        <span className="block text-[13px] text-ink-soft">{a.sub}</span>
                      </span>
                      <Icon name="chevron" size={18} className="text-ink-faint" />
                    </button>
                  </li>
                ))}
              </ul>
              {note && <p className="m-0 mt-3 text-center text-[14px] text-[#3d6b2a]" role="status">{note}</p>}
              {existing && (
                <div className="mt-4 flex items-center justify-between gap-3 border-t border-[var(--line)] pt-3">
                  <span className="text-[13px] text-ink-soft">Shared publicly · opened {existing.views}×</span>
                  <button
                    type="button"
                    onClick={async () => {
                      await postJson("/api/share", { token: existing.token }, "DELETE");
                      await shares.reload();
                      setNote("Stopped sharing. The link no longer works.");
                    }}
                    className="h-10 text-[14px] font-semibold text-[#a32418]"
                  >
                    Stop sharing
                  </button>
                </div>
              )}
            </m.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
