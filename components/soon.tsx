"use client";

import { strings } from "@/lib/i18n";
import { GlassPanel } from "./ui/glass";
import { useViewer } from "./viewer";

// Honest placeholder for a future milestone's tab: empty state, never a dead tab.
export function Soon({ kind }: { kind: "lane" | "rituals" | "gather" }) {
  const { lang } = useViewer();
  const t = strings(lang);
  const title = kind === "lane" ? t.tabs.lane : kind === "rituals" ? t.tabs.rituals : t.tabs.gather;
  const body = kind === "lane" ? t.empty.laneSoon : kind === "rituals" ? t.empty.ritualsSoon : t.empty.gatherSoon;
  return (
    <div className="pt-4">
      <h1 className="mb-4 text-3xl font-normal">{title}</h1>
      <GlassPanel className="p-6">
        <p className="m-0 text-[15px] text-ink-soft">{body}</p>
      </GlassPanel>
    </div>
  );
}
