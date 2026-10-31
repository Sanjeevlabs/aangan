// Trusted nearby (SPEC §29.9). Pure helpers (client + server).
// For every home, at most five people nearby, ranked: if the family can't
// reach them, call #1, then #2, and so on. Calls go through the phone's own
// dialer (tel:), so they're ordinary carrier calls; no in-app calling.

export const MAX_NEARBY = 5;

/** The public emergency number where that home is. Defaults to 112. */
export function emergencyNumber(tz: string): string {
  if (tz.startsWith("America/")) return "911";
  if (tz === "Europe/London") return "999";
  if (tz === "Asia/Tokyo") return "119";
  if (tz.startsWith("Australia/")) return "000";
  return "112";
}

/** Digits with an optional leading +; spaces, dashes and brackets dropped. */
export function normalizePhone(raw: string): string {
  const t = raw.trim();
  const digits = t.replace(/\D/g, "");
  return t.startsWith("+") ? `+${digits}` : digits;
}

/** E.164-ish: 7–15 digits, optional +. Spaces, dashes and brackets allowed in the input. */
export function isDialable(raw: string): boolean {
  if (!/^[+\d\s()-]*$/.test(raw.trim())) return false;
  return /^\+?\d{7,15}$/.test(normalizePhone(raw));
}

/** Native dialer link: the call goes through the local mobile provider. */
export function telHref(raw: string): string {
  return `tel:${normalizePhone(raw)}`;
}

/** WhatsApp click-to-chat needs the full number, digits only. */
export function waHref(raw: string): string {
  return `https://wa.me/${normalizePhone(raw).replace(/\D/g, "")}`;
}

/** Ranked #1 first: the rank is the order people were added (moving someone up swaps the stamps). */
export function rankNearby<T extends { id: string; createdAt: string }>(people: T[]): T[] {
  return [...people].sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
}

/** Local helpers (Care → Helpers): everyone who helps at home except the first-to-call list, which is Nearby's. */
export function everydayHelpers<T extends { emergency: boolean }>(helpers: T[]): T[] {
  return helpers.filter((h) => !h.emergency);
}
