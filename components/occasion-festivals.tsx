"use client";

import { AnimatePresence, m } from "framer-motion";
import { useEffect, useState } from "react";
import { cleanTitle, type OccasionConfig } from "@/lib/occasion-calendar";
import { postJson } from "@/lib/use-json";
import { cn } from "@/lib/utils";
import { Button, Icon } from "./ui/kit";

// "Festivals we keep": one family-level choice from rituals/*.json. Nothing
// about any person's faith is asked or stored; birthdays are always on.

export function FestivalsSheet({
  open,
  configs,
  kept,
  canEdit,
  onClose,
  onSaved,
}: {
  open: boolean;
  configs: OccasionConfig[];
  kept: string[];
  canEdit: boolean;
  onClose: () => void;
  onSaved: (kept: string[]) => void;
}) {
  const [picked, setPicked] = useState<string[]>(kept);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (open) {
      setPicked(kept);
      setFailed(false);
    }
  }, [open, kept]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  const festivals = configs.filter((c) => c.slug !== "birthday");
  const toggle = (slug: string) => setPicked((p) => (p.includes(slug) ? p.filter((s) => s !== slug) : [...p, slug]));

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center" role="dialog" aria-modal="true" aria-label="Festivals we keep">
          <m.button type="button" aria-label="Close" className="absolute inset-0 bg-black/30 backdrop-blur-[2px]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
          <m.div
            className="frost relative w-full max-w-[480px] overflow-y-auto rounded-t-[32px] px-5 pt-3"
            style={{ maxHeight: "80vh", paddingBottom: "calc(20px + env(safe-area-inset-bottom))" }}
            initial={{ y: 60, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 60, opacity: 0 }}
            transition={{ type: "spring", stiffness: 420, damping: 38 }}
          >
            <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-black/15" aria-hidden="true" />
            <h2 className="m-0 text-[22px]">Festivals we keep</h2>
            <p className="m-0 mt-1 text-[14px] text-ink-soft">Birthdays are always on. Pick the festivals your family celebrates; only these show up and get wishes.</p>
            <ul className="m-0 mt-4 list-none space-y-1.5 p-0">
              {festivals.map((c) => {
                const on = picked.includes(c.slug);
                return (
                  <li key={c.slug}>
                    <button
                      type="button"
                      role="checkbox"
                      aria-checked={on}
                      disabled={!canEdit}
                      onClick={() => toggle(c.slug)}
                      className={cn("press flex min-h-[56px] w-full items-center gap-3 rounded-[16px] px-4 py-2 text-left", on ? "bg-ink text-white" : "bg-white")}
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block text-[16px] font-semibold">{cleanTitle(c.title)}</span>
                        {c.cultureNotes && <span className={cn("line-clamp-1 block text-[12.5px]", on ? "text-white/70" : "text-ink-soft")}>{c.cultureNotes}</span>}
                      </span>
                      <span className={cn("grid h-6 w-6 shrink-0 place-items-center rounded-full", on ? "bg-white text-black" : "ring-1 ring-black/20")} aria-hidden="true">
                        {on && <Icon name="check" size={14} />}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
            {festivals.length === 0 && <p className="m-0 py-4 text-center text-[14px] text-ink-soft">No festival guides yet.</p>}
            {failed && <p className="m-0 mt-3 text-[14px] text-[#b42318]">Couldn&rsquo;t save. Try again.</p>}
            {canEdit ? (
              <Button
                className="mt-4 w-full"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  const out = await postJson<{ kept: string[] }>("/api/rituals", { action: "kept", kept: picked });
                  setBusy(false);
                  if (!out) return setFailed(true);
                  onSaved(out.kept);
                  onClose();
                }}
              >
                {busy ? "Saving…" : "Save"}
              </Button>
            ) : (
              <p className="m-0 mt-4 text-center text-[13px] text-ink-faint">A grown-up in the family can change this.</p>
            )}
          </m.div>
        </div>
      )}
    </AnimatePresence>
  );
}
