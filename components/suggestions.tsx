"use client";

import { useCallback, useEffect, useState } from "react";
import { strings } from "@/lib/i18n";
import type { Suggestion } from "@/lib/schemas";
import { PrimaryButton } from "./ui/buttons";
import { useViewer } from "./viewer";

// "Aangan suggests · Review / Approve" — flat surface card. Actions execute
// ONLY after approval (POST to the approve route).
export function Suggestions({ compact }: { compact?: boolean }) {
  const { lang } = useViewer();
  const t = strings(lang);
  const [items, setItems] = useState<Suggestion[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setFailed(false);
    try {
      const res = await fetch("/api/suggestions?status=pending", { cache: "no-store" });
      if (!res.ok) throw new Error("suggestions-fetch-failed");
      setItems(((await res.json()) as { suggestions: Suggestion[] }).suggestions);
    } catch {
      setFailed(true);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const act = async (id: string, approve: boolean) => {
    setBusyId(id);
    try {
      await fetch(`/api/suggestions/${id}/approve`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ decision: approve ? "approve" : "reject" }),
      });
      await load();
    } finally {
      setBusyId(null);
    }
  };

  if (items === null) {
    if (failed) return null;
    return (
      <div aria-busy="true" aria-label="Loading" className={compact ? "" : "mb-6"}>
        <div className="skeleton h-16" />
      </div>
    );
  }
  if (items.length === 0) return null;

  return (
    <section aria-label="Aangan suggests" className={compact ? "mb-4" : "mb-6"}>
      {!compact && <h2 className="mb-2 mt-0 text-xl">Aangan suggests</h2>}
      <ul className="m-0 list-none p-0">
        {items.map((s) => (
          <li key={s.id} className="mb-2 rounded-card border border-line bg-surface px-4 py-3">
            <p className="serif m-0 text-[16px] leading-snug">{s.goal}</p>
            <p className="m-1 text-[12px] text-ink-soft">Review · Approve to let Aangan act</p>
            <div className="mt-2 flex gap-2">
              <PrimaryButton
                className="!min-h-[44px] px-5 py-2 text-sm"
                disabled={busyId === s.id}
                onClick={() => void act(s.id, true)}
              >
                Approve
              </PrimaryButton>
              <button
                type="button"
                disabled={busyId === s.id}
                onClick={() => void act(s.id, false)}
                className="tap rounded-card border border-ink/25 px-5 text-sm font-semibold"
              >
                {t.common.cancel}
              </button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
