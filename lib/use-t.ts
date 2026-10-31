"use client";

// useT(): the app's own words in the viewer's language. Signed in, that is
// their displayLang; signed out, the browser's language. Missing keys read
// English. Content the family shares is translated elsewhere (Muse).

import { Fragment, createElement, useCallback, useEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from "react";
import { useViewer } from "@/components/viewer";
import { toLangCode, type LangCode } from "./languages";
import { cataloguesVersion, ensureCatalogue, htmlDir, htmlLang, subscribeCatalogues, translate, type UiKey, type Vars } from "./ui-strings/lazy";

function browserLang(): LangCode {
  if (typeof navigator === "undefined") return "en";
  for (const tag of navigator.languages ?? [navigator.language]) {
    const code = toLangCode(tag);
    if (code !== "en" || tag.toLowerCase().startsWith("en")) return code;
  }
  return "en";
}

export function useUiLang(): LangCode {
  const { ready, signedIn, displayLang } = useViewer();
  // SSR renders English; the browser's language arrives after mount.
  const [browser, setBrowser] = useState<LangCode>("en");
  useEffect(() => setBrowser(browserLang()), []);
  return ready && signedIn ? displayLang : browser;
}

export interface T {
  (key: UiKey, vars?: Vars): string;
  /** Like t(), but placeholders may be React nodes (e.g. a bold email). */
  rich: (key: UiKey, nodes: Record<string, ReactNode>) => ReactNode;
  lang: LangCode;
  dir: "rtl" | "ltr";
}

export function useT(): T {
  const lang = useUiLang();
  // A language other than English arrives as its own small download; words read English until then.
  const loadedVersion = useSyncExternalStore(subscribeCatalogues, cataloguesVersion, () => 0);
  useEffect(() => {
    void ensureCatalogue(lang);
  }, [lang]);
  const base = useCallback((key: UiKey, vars?: Vars) => translate(lang, key, vars), [lang, loadedVersion]);
  return useMemo(() => {
    const t = base as T;
    t.rich = (key, nodes) => {
      const parts = translate(lang, key).split(/(\{\w+\})/g);
      return createElement(
        Fragment,
        null,
        ...parts.map((p, i) => {
          const m = /^\{(\w+)\}$/.exec(p);
          return createElement(Fragment, { key: i }, m && m[1] in nodes ? nodes[m[1]] : p);
        }),
      );
    };
    t.lang = lang;
    t.dir = htmlDir(lang);
    return t;
  }, [base, lang]);
}

/** Keeps <html lang dir> in step with the viewer's language (rtl for ur/ar/fa/he/ps). */
export function useDocumentLang(): void {
  const lang = useUiLang();
  useEffect(() => {
    const el = document.documentElement;
    el.lang = htmlLang(lang);
    el.dir = htmlDir(lang);
  }, [lang]);
}

/**
 * Signed-in screens: the page's language follows the viewer, but direction
 * stays left-to-right until those screens are laid out for right-to-left too
 * (the first-run screens set dir themselves with useDocumentLang).
 */
export function DocumentLangOnly(): null {
  const lang = useUiLang();
  useEffect(() => {
    document.documentElement.lang = htmlLang(lang);
    document.documentElement.dir = "ltr";
  }, [lang]);
  return null;
}

/** Mount once inside ViewerProvider (e.g. in Shell) so every screen gets lang/dir. */
export function DocumentLang(): null {
  useDocumentLang();
  return null;
}
