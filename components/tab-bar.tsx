"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { strings } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { useShell } from "./shell";
import { useViewer } from "./viewer";

function Icon({ d, active }: { d: string; active: boolean }) {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill={active ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth={active ? 2 : 1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={d} />
    </svg>
  );
}

const PATHS = {
  home: "M3 11.5 12 4l9 7.5M5.5 10.5V20h13v-9.5",
  lane: "M4 6h16M4 12h16M4 18h10",
  rituals: "M5 6h14v14H5zM5 10h14M9 3v4M15 3v4",
  gather: "M8 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM3 20c0-3 2.5-5 5-5s5 2 5 5M16 11a3 3 0 1 0 0-6M17 15c2 .5 4 2 4 5",
} as const;

// Flat tab bar with a hairline top: Home · Lane · [+ dark rounded rect] ·
// Rituals · Gather. Glass lives only on sheets + mini-player, never here.
export function TabBar() {
  const pathname = usePathname();
  const { lang } = useViewer();
  const { openAdd, chromeHidden } = useShell();
  const t = strings(lang);

  if (chromeHidden) return null;

  const tabs = [
    { key: "home", href: "/", label: t.tabs.home, d: PATHS.home },
    { key: "lane", href: "/lane", label: t.tabs.lane, d: PATHS.lane },
    { key: "rituals", href: "/rituals", label: t.tabs.rituals, d: PATHS.rituals },
    { key: "gather", href: "/gather", label: t.tabs.gather, d: PATHS.gather },
  ];

  const renderTab = (tab: (typeof tabs)[number]) => {
    const active = pathname === tab.href;
    return (
      <Link
        key={tab.key}
        href={tab.href}
        aria-label={tab.label}
        aria-current={active ? "page" : undefined}
        className={cn(
          "tap flex w-14 flex-col items-center justify-center gap-1 text-[11px] font-medium",
          active ? "text-ink" : "text-ink-soft",
        )}
      >
        <Icon d={tab.d} active={active} />
        <span>{tab.label}</span>
      </Link>
    );
  };

  return (
    <nav
      aria-label="Primary"
      className="fixed bottom-0 left-1/2 z-40 w-full max-w-[480px] -translate-x-1/2 border-t border-line bg-paper"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="flex items-end justify-between px-3 py-2">
        {renderTab(tabs[0])}
        {renderTab(tabs[1])}
        <button
          type="button"
          onClick={() => openAdd("photos")}
          aria-label={t.tabs.add}
          className="tap flex h-11 w-16 items-center justify-center rounded-card bg-espresso text-xl leading-none text-espresso-ink"
        >
          <span aria-hidden="true">+</span>
        </button>
        {renderTab(tabs[2])}
        {renderTab(tabs[3])}
      </div>
    </nav>
  );
}
