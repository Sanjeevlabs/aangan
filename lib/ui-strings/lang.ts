import { isRtl, toLangCode } from "../languages";

/** The html lang attribute for a registry code (hi-deva → hi, hi-latn → hi-Latn). */
export function htmlLang(lang: string | null | undefined): string {
  const code = toLangCode(lang);
  if (code === "hi-deva") return "hi";
  if (code === "hi-latn") return "hi-Latn";
  return code;
}

export function htmlDir(lang: string | null | undefined): "rtl" | "ltr" {
  return isRtl(lang) ? "rtl" : "ltr";
}
