"use client";

import { useDisplayText } from "@/lib/use-display-text";
import { useViewer } from "./viewer";

/** Family words, shown in the reader's language (Muse translates, cached). */
export function Translated({ text, lang = "en" }: { text: string; lang?: string }) {
  const { displayLang } = useViewer();
  const { text: shown } = useDisplayText(text, lang, displayLang);
  return <>{shown ?? text}</>;
}
