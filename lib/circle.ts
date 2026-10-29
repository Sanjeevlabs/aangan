// The local circle (SPEC §29.9). Pure helpers.

/** The public emergency number where that home is. Defaults to 112. */
export function emergencyNumber(tz: string): string {
  if (tz.startsWith("America/")) return "911";
  if (tz === "Europe/London") return "999";
  if (tz === "Asia/Tokyo") return "119";
  if (tz.startsWith("Australia/")) return "000";
  return "112";
}
