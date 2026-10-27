"use client";

import { useEffect, useRef, useState } from "react";
import { needsDisplayText } from "./voice";

// Translated view of a stored original string in the viewer's display_lang.
// Returns the original immediately when no translation is needed; otherwise
// returns null while the cached per-card+lang translation loads, so the UI
// shows a skeleton and never flashes untranslated Hindi.
export function useDisplayText(
  original: string,
  sourceLang: string | null | undefined,
  displayLang: string,
): { text: string | null; translated: boolean } {
  const [translated, setTranslated] = useState<string | null>(null);
  const cache = useRef(new Map<string, string>());

  const need = needsDisplayText(original, sourceLang, displayLang);

  useEffect(() => {
    if (!need) {
      setTranslated(null);
      return;
    }
    const key = `${displayLang}::${original}`;
    const hit = cache.current.get(key);
    if (hit) {
      setTranslated(hit);
      return;
    }
    let live = true;
    setTranslated(null);
    fetch("/api/translate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: original, targetLang: displayLang }),
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { translation?: { text?: string } } | null) => {
        if (!live) return;
        const next = data?.translation?.text ?? original;
        cache.current.set(key, next);
        setTranslated(next);
      })
      .catch(() => {
        if (live) setTranslated(original);
      });
    return () => {
      live = false;
    };
  }, [original, sourceLang, displayLang, need]);

  if (!need) return { text: original, translated: false };
  if (translated === null) return { text: null, translated: true };
  return { text: translated, translated: true };
}
