// Safe & sound: what a check-in means right now. Pure (client + server).
// Alerts exist only for a missed promise: "heading home ~40 min" with no
// "home safe" 20 minutes after the ETA, a journey not "landed" 2 hours after,
// or an explicit "I need help". Everything else is calm status.
import type { SafetyCheckin } from "./kinds";

export const GRACE_MIN = { heading: 20, journey: 120 } as const;
export const LOCATION_TTL_MS = 24 * 3_600_000;

export type SafetyState =
  | { tone: "calm"; label: string; at: string; checkin: SafetyCheckin }
  | { tone: "pending"; label: string; at: string; etaAt: string; checkin: SafetyCheckin }
  | { tone: "overdue"; label: string; at: string; etaAt: string; checkin: SafetyCheckin }
  | { tone: "help"; label: string; at: string; checkin: SafetyCheckin };

export function stateOf(checkins: SafetyCheckin[], memberId: string, now = Date.now()): SafetyState | null {
  const mine = checkins.filter((c) => c.memberId === memberId).sort((a, b) => b.at.localeCompare(a.at) || Number(Boolean(a.closedAt)) - Number(Boolean(b.closedAt)));
  const latest = mine[0];
  if (!latest) return null;
  if (latest.kind === "help" && !latest.closedAt) return { tone: "help", label: "Asked for help", at: latest.at, checkin: latest };
  if ((latest.kind === "heading" || latest.kind === "journey") && !latest.closedAt && latest.etaAt) {
    const grace = latest.kind === "heading" ? GRACE_MIN.heading : GRACE_MIN.journey;
    const late = now > Date.parse(latest.etaAt) + grace * 60_000;
    const label = latest.kind === "heading" ? "Heading home" : "Travelling";
    return late ? { tone: "overdue", label: `Hasn't checked in`, at: latest.at, etaAt: latest.etaAt, checkin: latest } : { tone: "pending", label, at: latest.at, etaAt: latest.etaAt, checkin: latest };
  }
  const closedLabel = latest.kind === "journey" ? "Landed safe" : latest.kind === "help" ? "Okay now" : latest.kind === "out-late" ? "Out late" : "Home safe";
  return { tone: "calm", label: latest.kind === "heading" && latest.closedAt ? "Home safe" : closedLabel, at: latest.closedAt ?? latest.at, checkin: latest };
}

/** Strip a location that's older than a day (privacy: it must not linger). */
export function withoutStaleLocation(c: SafetyCheckin, now = Date.now()): SafetyCheckin {
  return c.location && now - Date.parse(c.location.at) > LOCATION_TTL_MS ? { ...c, location: null } : c;
}

/** Emergency number for where someone is, from their time zone's country. */
const EMERGENCY: [RegExp, { number: string; country: string }][] = [
  [/^Asia\/(Kolkata|Calcutta)$/, { number: "112", country: "India" }],
  [/^America\/(New_York|Chicago|Denver|Los_Angeles|Phoenix|Anchorage|Detroit)$|^Pacific\/Honolulu$/, { number: "911", country: "the US" }],
  [/^America\/(Toronto|Vancouver|Edmonton|Winnipeg|Halifax)$/, { number: "911", country: "Canada" }],
  [/^America\/Mexico_City$/, { number: "911", country: "Mexico" }],
  [/^Europe\/London$/, { number: "999", country: "the UK" }],
  [/^Europe\/Dublin$/, { number: "112", country: "Ireland" }],
  [/^Europe\//, { number: "112", country: "Europe" }],
  [/^Australia\//, { number: "000", country: "Australia" }],
  [/^Pacific\/Auckland$/, { number: "111", country: "New Zealand" }],
  [/^Asia\/(Dubai|Riyadh|Qatar|Bahrain|Kuwait|Muscat)$/, { number: "999", country: "the Gulf" }],
  [/^Asia\/Singapore$/, { number: "995", country: "Singapore (ambulance)" }],
  [/^Asia\/Tokyo$/, { number: "119", country: "Japan (ambulance)" }],
  [/^Asia\/Seoul$/, { number: "119", country: "Korea (ambulance)" }],
  [/^Asia\/(Shanghai|Hong_Kong)$/, { number: "120", country: "China (ambulance)" }],
  [/^Asia\/Karachi$/, { number: "1122", country: "Pakistan" }],
  [/^Asia\/Dhaka$/, { number: "999", country: "Bangladesh" }],
  [/^Asia\/Kathmandu$/, { number: "100", country: "Nepal (police)" }],
  [/^Asia\/Colombo$/, { number: "1990", country: "Sri Lanka (ambulance)" }],
  [/^Africa\/Nairobi$/, { number: "999", country: "Kenya" }],
  [/^Africa\/Lagos$/, { number: "112", country: "Nigeria" }],
  [/^America\/Sao_Paulo$/, { number: "192", country: "Brazil (ambulance)" }],
];
export function emergencyFor(tz: string): { number: string; country: string } {
  return EMERGENCY.find(([re]) => re.test(tz))?.[1] ?? { number: "112", country: "most countries (works on any mobile)" };
}

export function mapsLink(loc: { lat: number; lng: number }): string {
  return `https://maps.google.com/?q=${loc.lat.toFixed(5)},${loc.lng.toFixed(5)}`;
}
