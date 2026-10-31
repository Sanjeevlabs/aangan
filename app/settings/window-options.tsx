"use client";

import { useState } from "react";
import { Avatar } from "@/components/ui/kit";
import { useViewer } from "@/components/viewer";
import type { Wall } from "@/lib/kinds";
import { callName, memberPhoto } from "@/lib/people";
import { can } from "@/lib/permissions";
import { postJson, useJson } from "@/lib/use-json";
import { cn } from "@/lib/utils";
import { WALL_LOOK, wallChip } from "@/lib/walls";
import { placeFromTz } from "@/lib/zones";

// The window's own options, moved here from the first screen: the paint on
// the wall around it, and who is at it (up to two). Same /api/window actions;
// the server still checks can(member, "window.at").

interface W {
  wall: Wall;
  people: { id: string }[];
}

export function WindowOptions() {
  const { viewer, members } = useViewer();
  const { data, reload } = useJson<W>("/api/window");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const save = async (body: unknown) => {
    setBusy(true);
    setError(null);
    const out = await postJson<{ view?: unknown }>("/api/window", body);
    if (!out?.view) setError("Couldn't save that. Try again.");
    await reload();
    setBusy(false);
  };
  if (!data) return <div className="skeleton mt-5 h-[140px] rounded-card" aria-busy="true" aria-label="Loading wall and people" />;
  const chosen = data.people.map((p) => p.id);
  const others = members.filter((mm) => mm.id !== viewer.id && mm.role !== "child" && can(mm, "window.at"));
  return (
    <div id="window-options" className="mt-6 scroll-mt-6">
      <p className="m-0 text-[13px] font-medium text-ink-soft">Wall colour</p>
      <div className="mt-2 flex flex-wrap gap-2.5" role="radiogroup" aria-label="Wall colour">
        {(Object.keys(WALL_LOOK) as Wall[]).map((w) => (
          <button
            key={w}
            type="button"
            role="radio"
            aria-checked={data.wall === w}
            aria-label={WALL_LOOK[w].label}
            disabled={busy}
            onClick={() => void save({ action: "wall", wall: w })}
            className={cn("press h-11 w-11 rounded-[12px] shadow-[inset_0_1px_0_rgba(255,255,255,.35),0_1px_2px_rgba(0,0,0,.25)] ring-1 ring-black/10", data.wall === w && "outline outline-2 outline-offset-[3px] outline-ink")}
            style={{ background: wallChip(w), backgroundBlendMode: "multiply, normal" }}
          />
        ))}
      </div>
      <p className="m-0 mt-1.5 text-[12px] text-ink-faint">Lime-washed paint around your window. Only you see it.</p>

      <p className="m-0 mt-5 text-[13px] font-medium text-ink-soft">Who&rsquo;s at your window · up to two</p>
      {others.length === 0 ? (
        <p className="m-0 mt-2 text-[14px] text-ink-soft">When grown-ups in another home join, you can put them here.</p>
      ) : (
        <ul className="m-0 mt-1 list-none p-0">
          {others.map((mm) => {
            const on = chosen.includes(mm.id);
            const full = !on && chosen.length >= 2;
            return (
              <li key={mm.id} className="flex items-center gap-3 border-t border-[var(--line)] py-2.5 first:border-0">
                <Avatar src={memberPhoto(mm)} name={callName(mm)} size={34} />
                <span className="min-w-0 flex-1">
                  <span className="block text-[15px]">{callName(mm)}</span>
                  <span className="block text-[12px] text-ink-soft">{mm.city || placeFromTz(mm.tz)}</span>
                </span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={on}
                  aria-label={`${callName(mm)} at your window`}
                  disabled={busy || full}
                  onClick={() => void save({ action: "people", people: on ? chosen.filter((id) => id !== mm.id) : [...chosen, mm.id] })}
                  className={cn("relative h-[26px] w-[44px] shrink-0 rounded-full transition-colors disabled:opacity-35", on ? "bg-ink" : "bg-black/15")}
                >
                  <span className={cn("absolute top-[3px] h-5 w-5 rounded-full bg-white shadow transition-all", on ? "left-[21px]" : "left-[3px]")} />
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {error && (
        <p className="m-0 mt-2 text-[13px] text-[#c2343a]" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
