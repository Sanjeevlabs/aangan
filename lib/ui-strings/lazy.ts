// The app's own words, loaded per language. lib/ui-strings/index.ts holds every
// catalogue in one module (what the tests read); the app reads this one, so a
// phone only downloads the language it shows (English is always in). A language
// that has not arrived yet reads English, key by key, as a missing key does.
// tests/ui-strings-lazy.test.ts keeps LOADERS and CATALOGUES in step.

import { baseLang, toLangCode } from "../languages";
import { en, type Catalogue, type UiKey } from "./en";
import { htmlDir, htmlLang } from "./lang";

export { en, htmlDir, htmlLang, type Catalogue, type UiKey };
export type Vars = Record<string, string | number>;

/** Keyed like CATALOGUES in index.ts. */
export const LOADERS: Record<string, () => Promise<Catalogue>> = {
  "hi-deva": () => import("./hi").then((m) => m.hi),
  bn: () => import("./bn").then((m) => m.bn),
  ta: () => import("./ta").then((m) => m.ta),
  te: () => import("./te").then((m) => m.te),
  mr: () => import("./mr").then((m) => m.mr),
  gu: () => import("./gu").then((m) => m.gu),
  kn: () => import("./kn").then((m) => m.kn),
  ml: () => import("./ml").then((m) => m.ml),
  pa: () => import("./pa").then((m) => m.pa),
  ur: () => import("./ur").then((m) => m.ur),
  es: () => import("./es").then((m) => m.es),
  ar: () => import("./ar").then((m) => m.ar),
};

const loaded: Record<string, Catalogue> = {};
const pending: Record<string, Promise<void>> = {};
const listeners = new Set<() => void>();
let version = 0;

function keyFor(lang: string | null | undefined): string | null {
  const code = toLangCode(lang);
  if (code in LOADERS) return code;
  const base = baseLang(code);
  return base in LOADERS ? base : null;
}

/** True when the app's own words exist in this language (beyond English). */
export function hasUiCatalogue(lang: string | null | undefined): boolean {
  return toLangCode(lang) === "en" || keyFor(lang) !== null;
}

/** Fetch this language's catalogue (once). Resolves when it is ready to read. */
export function ensureCatalogue(lang: string | null | undefined): Promise<void> {
  const key = keyFor(lang);
  if (!key || loaded[key]) return Promise.resolve();
  pending[key] ??= LOADERS[key]()
    .then((cat) => {
      loaded[key] = cat;
      version += 1;
      listeners.forEach((l) => l());
    })
    .catch(() => {
      delete pending[key]; // offline: English now, another try on the next call
    });
  return pending[key];
}

/** For useSyncExternalStore: changes when a catalogue arrives. */
export function subscribeCatalogues(onChange: () => void): () => void {
  listeners.add(onChange);
  return () => {
    listeners.delete(onChange);
  };
}
export function cataloguesVersion(): number {
  return version;
}

/** One string, with {placeholders} filled. Not loaded yet, or missing key → English. */
export function translate(lang: string | null | undefined, key: UiKey, vars?: Vars): string {
  const k = keyFor(lang);
  const raw = (k ? loaded[k]?.[key] : undefined) ?? en[key];
  if (!vars) return raw;
  return raw.replace(/\{(\w+)\}/g, (m, name: string) => (name in vars ? String(vars[name]) : m));
}
