// Message catalogues for the app's own words. English is the source of keys;
// every other locale is partial and falls back to English per key.
// Add a locale: write lib/ui-strings/<base>.ts and list it here.

import { baseLang, toLangCode } from "../languages";
import { htmlDir, htmlLang } from "./lang";
import { ar } from "./ar";
import { bn } from "./bn";
import { en, type Catalogue, type UiKey } from "./en";
import { es } from "./es";
import { gu } from "./gu";
import { hi } from "./hi";
import { kn } from "./kn";
import { ml } from "./ml";
import { mr } from "./mr";
import { pa } from "./pa";
import { ta } from "./ta";
import { te } from "./te";
import { ur } from "./ur";

export { en, htmlDir, htmlLang, type Catalogue, type UiKey };

/** Keyed by registry code (hi-deva) or base code (ta). Hinglish (hi-latn) reads English. */
export const CATALOGUES: Record<string, Catalogue> = {
  "hi-deva": hi,
  bn,
  ta,
  te,
  mr,
  gu,
  kn,
  ml,
  pa,
  ur,
  es,
  ar,
};

export type Vars = Record<string, string | number>;

function catalogueFor(lang: string | null | undefined): Catalogue | null {
  const code = toLangCode(lang);
  return CATALOGUES[code] ?? CATALOGUES[baseLang(code)] ?? null;
}

/** True when the app's own words exist in this language (beyond English). */
export function hasUiCatalogue(lang: string | null | undefined): boolean {
  return toLangCode(lang) === "en" || catalogueFor(lang) !== null;
}

/** One string, with {placeholders} filled. Missing key → English. */
export function translate(lang: string | null | undefined, key: UiKey, vars?: Vars): string {
  const raw = catalogueFor(lang)?.[key] ?? en[key];
  if (!vars) return raw;
  return raw.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m));
}

