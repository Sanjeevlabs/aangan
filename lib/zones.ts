// Where family lives, as people say it ("India", "New York"), not as IANA
// says it. Shared by Settings, the tree, Sit together and local helpers.

export const ZONES: { tz: string; place: string }[] = [
  { tz: "Asia/Kolkata", place: "India" },
  { tz: "Asia/Karachi", place: "Pakistan" },
  { tz: "Asia/Dhaka", place: "Bangladesh" },
  { tz: "Asia/Kathmandu", place: "Nepal" },
  { tz: "Asia/Colombo", place: "Sri Lanka" },
  { tz: "Asia/Dubai", place: "UAE" },
  { tz: "Asia/Riyadh", place: "Saudi Arabia" },
  { tz: "Asia/Singapore", place: "Singapore" },
  { tz: "Asia/Manila", place: "Philippines" },
  { tz: "Asia/Jakarta", place: "Indonesia" },
  { tz: "Asia/Shanghai", place: "China" },
  { tz: "Asia/Tokyo", place: "Japan" },
  { tz: "Asia/Seoul", place: "Korea" },
  { tz: "Africa/Nairobi", place: "Kenya" },
  { tz: "Africa/Lagos", place: "Nigeria" },
  { tz: "Europe/London", place: "UK" },
  { tz: "Europe/Berlin", place: "Germany" },
  { tz: "Europe/Paris", place: "France" },
  { tz: "Europe/Madrid", place: "Spain" },
  { tz: "America/New_York", place: "New York" },
  { tz: "America/Chicago", place: "Chicago" },
  { tz: "America/Denver", place: "Denver" },
  { tz: "America/Los_Angeles", place: "California" },
  { tz: "America/Toronto", place: "Toronto" },
  { tz: "America/Mexico_City", place: "Mexico" },
  { tz: "America/Sao_Paulo", place: "Brazil" },
  { tz: "Australia/Sydney", place: "Sydney" },
  { tz: "Pacific/Auckland", place: "New Zealand" },
];

const PLACE = new Map(ZONES.map((z) => [z.tz, z.place]));
PLACE.set("Asia/Calcutta", "India");

export function placeFromTz(tz: string | null | undefined): string {
  if (!tz || tz === "UTC") return "Somewhere";
  return PLACE.get(tz) ?? (tz.split("/").pop() ?? tz).replace(/_/g, " ");
}

/** "7:40 PM" in that zone right now, or at `at`. */
export function timeIn(tz: string, at: Date = new Date(), opts: Intl.DateTimeFormatOptions = { hour: "numeric", minute: "2-digit" }): string {
  try {
    return new Intl.DateTimeFormat("en-US", { ...opts, timeZone: tz }).format(at);
  } catch {
    return "";
  }
}

/** Local hour (0–23, fractional) in a zone at an instant. */
export function hourIn(tz: string, at: Date = new Date()): number {
  try {
    const parts = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "numeric", hourCycle: "h23", timeZone: tz }).formatToParts(at);
    const h = Number(parts.find((p) => p.type === "hour")?.value ?? 0);
    const m = Number(parts.find((p) => p.type === "minute")?.value ?? 0);
    return h + m / 60;
  } catch {
    return at.getUTCHours();
  }
}

/** Awake and reachable: 7 AM to 10 PM local. */
export function isAwake(tz: string, at: Date = new Date()): boolean {
  const h = hourIn(tz, at);
  return h >= 7 && h < 22;
}

/** Day part where they are, for warm copy ("her evening"). */
export function dayPartIn(tz: string, at: Date = new Date()): "early morning" | "morning" | "afternoon" | "evening" | "night" {
  const h = hourIn(tz, at);
  if (h < 5 || h >= 22) return "night";
  if (h < 8) return "early morning";
  if (h < 12) return "morning";
  if (h < 17) return "afternoon";
  return "evening";
}
