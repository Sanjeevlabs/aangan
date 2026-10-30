"use client";

import { useMemo, useState } from "react";
import type { WindowLayer } from "@/lib/kinds";
import { resolveMediaUrl } from "@/lib/media-session";
import { cardCover } from "@/lib/people";
import { useFamilyCards } from "@/lib/use-family";
import { postJson, useJson } from "@/lib/use-json";
import { cn } from "@/lib/utils";
import type { DayPhase } from "@/lib/weather";
import { ArchWindow } from "./window";
import { Icon } from "./ui/kit";
import { QUIET_CHOICES } from "@/lib/status";
import { scenesFor } from "@/lib/scenes";
import type { Weather } from "@/lib/weather";
import { useViewer } from "./viewer";

// Choose what your window shows: their sky (real landscapes matching their
// weather and hour, as a slow slideshow) or any family photo. Each person
// chooses their own.

interface W {
  imageRef: string;
  phase: DayPhase;
  layers: WindowLayer[];
  far: { names: string } | null;
  view: { cardId: string | null; style: "still" | "living" } | null;
  quietAfterHours: number;
  weather: Weather | null;
}

export function WindowSettings() {
  const { members } = useViewer();
  const { cards } = useFamilyCards();
  const { data, reload } = useJson<W>("/api/window");
  const [busy, setBusy] = useState(false);
  const photos = useMemo(() => (cards ?? []).filter((c) => c.type === "photo").slice(0, 12), [cards]);
  const style = data?.view?.style ?? "living";
  const chosen = data?.view?.cardId ?? null;
  const choose = async (cardId: string | null, s = style) => {
    setBusy(true);
    await postJson("/api/window", { action: "choose", cardId, style: s });
    if (s === "living") await postJson("/api/window", { action: "compose" });
    await reload();
    setBusy(false);
  };
  const scene = data ? scenesFor(data.phase, data.weather?.kind ?? null)[0] : "";
  if (!data) return <div className="skeleton h-[220px] rounded-card" aria-busy="true" aria-label="Loading your window" />;
  return (
    <div>
      <div className="flex gap-4">
        <ArchWindow src={(chosen ? resolveMediaUrl(data.imageRef) : null) ?? scene} layers={data.layers} phase={data.phase} living={style === "living"} className="h-[150px] w-[120px] shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="m-0 text-[15px] text-ink-soft">What you see first when you open Aangan: a window to {data.far?.names ?? "the other home"}.</p>
          <div className="mt-3 grid grid-cols-2 gap-1 rounded-full bg-surface p-1">
            {(["living", "still"] as const).map((s) => (
              <button key={s} type="button" aria-pressed={style === s} disabled={busy} onClick={() => void choose(chosen, s)} className={cn("press h-9 rounded-full text-[14px] font-semibold", style === s ? "bg-white text-ink shadow-sm" : "text-ink-soft")}>
                {s === "living" ? "Slideshow" : "Still"}
              </button>
            ))}
          </div>
          {style === "living" && <p className="m-0 mt-2 text-[12.5px] text-ink-faint">Changes slowly, like a lock screen</p>}
        </div>
      </div>
      <p className="m-0 mb-2 mt-5 text-[13px] font-medium text-ink-soft">Turn their dot amber when they&rsquo;ve been quiet for</p>
      <div className="flex gap-1.5" role="radiogroup" aria-label="Amber after">
        {QUIET_CHOICES.map((h) => (
          <button
            key={h}
            type="button"
            role="radio"
            aria-checked={data.quietAfterHours === h}
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              await postJson("/api/window", { action: "quiet", hours: h });
              await reload();
              setBusy(false);
            }}
            className={cn("press h-10 flex-1 rounded-full text-[14px] font-semibold", data.quietAfterHours === h ? "bg-ink text-white" : "bg-surface text-ink-soft")}
          >
            {h} h
          </button>
        ))}
      </div>
      <p className="m-0 mt-1.5 text-[12px] text-ink-faint">Only during their day. At night it shows &ldquo;asleep&rdquo;. Based on activity in Aangan.</p>
      <p className="m-0 mb-2 mt-5 text-[13px] font-medium text-ink-soft">Choose a photo</p>
      <ul className="m-0 grid list-none grid-cols-4 gap-2 p-0">
        <li>
          <button type="button" onClick={() => void choose(null)} disabled={busy} aria-pressed={chosen === null} className={cn("press relative grid aspect-square w-full place-items-center overflow-hidden rounded-[14px] bg-surface text-[12px] font-semibold text-white", chosen === null && "ring-[3px] ring-ink")}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={scene} alt="" className="absolute inset-0 h-full w-full object-cover" />
            <span className="relative flex flex-col items-center gap-1 [text-shadow:0_1px_6px_rgba(0,0,0,.6)]">
              <Icon name="cloud" size={18} /> Their sky
            </span>
          </button>
        </li>
        {photos.map((c) => (
          <li key={c.id}>
            <button type="button" onClick={() => void choose(c.id)} disabled={busy} aria-pressed={chosen === c.id} aria-label={c.caption || "Family photo"} className={cn("press relative block aspect-square w-full overflow-hidden rounded-[14px] bg-surface", chosen === c.id && "ring-[3px] ring-ink")}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={cardCover(c, members)} alt="" className="h-full w-full object-cover" />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
