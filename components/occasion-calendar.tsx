"use client";

import { useMemo, useRef, useState } from "react";
import { monthGrid, type CalOccasion } from "@/lib/occasion-calendar";
import { cn } from "@/lib/utils";
import { Icon } from "./ui/kit";

// A compact month: dots on days with a birthday or a kept festival. Swipe
// or use the arrows to change month; tap a day to see what's on it.

const WEEK = ["S", "M", "T", "W", "T", "F", "S"];

export function OccasionMonth({
  today,
  occasionsFor,
  renderDay,
}: {
  today: string;
  /** Occasions inside [start, end] (inclusive ISO dates). */
  occasionsFor: (start: string, end: string) => CalOccasion[];
  renderDay: (iso: string, list: CalOccasion[]) => React.ReactNode;
}) {
  const [offset, setOffset] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const touch = useRef<number | null>(null);
  const base = new Date(`${today}T12:00:00Z`);
  const year = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() + offset, 1)).getUTCFullYear();
  const month0 = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() + offset, 1)).getUTCMonth();
  const cells = useMemo(() => monthGrid(year, month0), [year, month0]);
  const list = useMemo(() => occasionsFor(cells[0].iso, cells[cells.length - 1].iso), [cells, occasionsFor]);
  const byDay = useMemo(() => {
    const map = new Map<string, CalOccasion[]>();
    for (const o of list) map.set(o.date, [...(map.get(o.date) ?? []), o]);
    return map;
  }, [list]);
  const label = new Date(Date.UTC(year, month0, 1)).toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
  const move = (d: number) => {
    setOffset((o) => Math.max(-12, Math.min(12, o + d)));
    setPicked(null);
  };
  const pickedList = picked ? (byDay.get(picked) ?? []) : [];

  return (
    <section aria-label="Calendar" className="rounded-card bg-surface p-3">
      <div className="mb-1 flex items-center">
        <button type="button" onClick={() => move(-1)} aria-label="Previous month" className="press grid h-10 w-10 place-items-center rounded-full">
          <Icon name="back" size={20} />
        </button>
        <h2 className="m-0 flex-1 text-center text-[16px] font-semibold" aria-live="polite">
          {label}
        </h2>
        <button type="button" onClick={() => move(1)} aria-label="Next month" className="press grid h-10 w-10 place-items-center rounded-full">
          <Icon name="chevron" size={20} />
        </button>
      </div>
      <div
        className="grid grid-cols-7 gap-y-0.5 text-center"
        onTouchStart={(e) => (touch.current = e.touches[0]?.clientX ?? null)}
        onTouchEnd={(e) => {
          const x0 = touch.current;
          const x1 = e.changedTouches[0]?.clientX;
          touch.current = null;
          if (x0 === null || x1 === undefined || Math.abs(x1 - x0) < 48) return;
          move(x1 < x0 ? 1 : -1);
        }}
      >
        {WEEK.map((d, i) => (
          <span key={i} className="pb-1 text-[11px] font-semibold text-ink-faint" aria-hidden="true">
            {d}
          </span>
        ))}
        {cells.map((c) => {
          const on = byDay.get(c.iso) ?? [];
          const isToday = c.iso === today;
          const sel = picked === c.iso;
          return (
            <button
              key={c.iso}
              type="button"
              onClick={() => setPicked(sel ? null : c.iso)}
              aria-pressed={sel}
              aria-label={`${new Date(`${c.iso}T12:00:00Z`).toLocaleDateString("en-US", { month: "long", day: "numeric", timeZone: "UTC" })}${on.length ? `, ${on.length} occasion${on.length > 1 ? "s" : ""}` : ""}`}
              className={cn(
                "press relative mx-auto grid h-10 w-10 place-items-center rounded-full text-[14px] tnum",
                !c.inMonth && "text-ink-faint/60",
                isToday && !sel && "font-bold ring-1 ring-ink",
                sel && "bg-ink font-semibold text-white",
              )}
            >
              {c.day}
              {on.length > 0 && (
                <span className="absolute bottom-1 left-1/2 flex -translate-x-1/2 gap-[2px]" aria-hidden="true">
                  {on.slice(0, 3).map((o) => (
                    <span key={o.id} className={cn("h-[4px] w-[4px] rounded-full", sel ? "bg-white" : o.memberId ? "bg-ink" : "bg-ink-soft ring-1 ring-ink-soft")} />
                  ))}
                </span>
              )}
            </button>
          );
        })}
      </div>
      {picked && (
        <div className="mt-2 border-t border-[var(--line)] pt-2">
          {pickedList.length ? renderDay(picked, pickedList) : <p className="m-0 py-2 text-center text-[14px] text-ink-soft">Nothing on this day.</p>}
        </div>
      )}
    </section>
  );
}
