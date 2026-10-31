import { Icon } from "./ui/kit";

// Visits & holidays: one monochrome mark per plan (a visit home, a holiday).
export function PlanBadge({ holiday = false, size = 44 }: { holiday?: boolean; size?: number }) {
  return (
    <span className="grid shrink-0 place-items-center rounded-[14px] bg-well text-ink" style={{ width: size, height: size }} aria-hidden="true">
      <Icon name={holiday ? "sun" : "village"} size={Math.round(size / 2)} />
    </span>
  );
}

export function daysUntil(iso: string | null, now = Date.now()): number | null {
  if (!iso) return null;
  return Math.ceil((Date.parse(iso) - now) / 86_400_000);
}

/** "in 12 days", "today", "" once it's past. */
export function countdownWords(days: number | null): string {
  if (days === null || days < 0) return "";
  return days === 0 ? "today" : `in ${days} day${days > 1 ? "s" : ""}`;
}
