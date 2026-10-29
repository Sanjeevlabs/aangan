import type { Project } from "@/lib/kinds";

// One look per kind of activity (flat shapes, no people).
export const KIND_LOOK: Record<Project["kind"], { label: string; bg: string; ink: string; accent: string }> = {
  play: { label: "Play", bg: "#e7eefc", ink: "#2f4f8a", accent: "#5b7fb5" },
  make: { label: "Make", bg: "#f6e8d8", ink: "#7a4a1d", accent: "#d9733a" },
  learn: { label: "Learn", bg: "#e6f2e0", ink: "#3d6b2a", accent: "#7fb069" },
  celebrate: { label: "Celebrate", bg: "#fbe6ea", ink: "#8a2f45", accent: "#d97a8f" },
  visit: { label: "Visit", bg: "#fff2d6", ink: "#8a5a12", accent: "#f2a516" },
};

export function KindBadge({ kind }: { kind: Project["kind"] }) {
  const k = KIND_LOOK[kind];
  return (
    <span className="grid h-11 w-11 shrink-0 place-items-center rounded-[14px]" style={{ background: k.bg }} aria-hidden="true">
      <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke={k.ink} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        {kind === "play" && <path d="M6 9h12a3 3 0 0 1 3 3v2a4 4 0 0 1-7 2.6h-4A4 4 0 0 1 3 14v-2a3 3 0 0 1 3-3zM8 12v2M7 13h2M15.5 12.5h.01M17.5 14h.01" />}
        {kind === "make" && <path d="M4 20h16M6 20v-6l6-5 6 5v6M10 20v-4h4v4" />}
        {kind === "learn" && <path d="M4 6l8-3 8 3-8 3-8-3zM6 8v5c0 2 3 3.5 6 3.5s6-1.5 6-3.5V8M20 6v6" />}
        {kind === "celebrate" && <path d="M5 21l3-10 5 5-8 5zM13 4v2M18 6l-1.5 1.5M20 11h-2M15 9l3-3" />}
        {kind === "visit" && <path d="M3 13l18-8-6 16-3-6-9-2zM12 15l3-6" />}
      </svg>
    </span>
  );
}

export function daysUntil(iso: string | null, now = Date.now()): number | null {
  if (!iso) return null;
  return Math.ceil((Date.parse(iso) - now) / 86_400_000);
}
