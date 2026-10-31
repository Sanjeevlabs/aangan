"use client";

import { useRef, useState } from "react";
import { Avatar, Icon } from "@/components/ui/kit";
import { useViewer } from "@/components/viewer";
import { PotArt, PotDefs } from "@/components/window-pots";
import { SceneThumb } from "@/components/window-scenes";
import { FIRST_SCENES, POTS, type FirstScene, type Pot, type Wall } from "@/lib/kinds";
import { processHomeImage } from "@/lib/media-client";
import { resolveMediaUrl } from "@/lib/media-session";
import { POT_LOOK } from "@/lib/pots";
import { scenesFor } from "@/lib/scenes";
import type { DayPhase, Weather } from "@/lib/weather";
import { callName, memberPhoto } from "@/lib/people";
import { can } from "@/lib/permissions";
import { postJson, useJson } from "@/lib/use-json";
import { cn } from "@/lib/utils";
import { WALL_LOOK, wallChip } from "@/lib/walls";
import { placeFromTz } from "@/lib/zones";

// Your first screen: where you stand (window, balcony or courtyard), what you
// see (the living album or a photo of their actual home), up to three flower
// pots, the paint on the wall, and who is at it (up to two). All through
// /api/window; the server validates every choice and checks can(member, "window.at").

interface W {
  wall: Wall;
  people: { id: string }[];
  scene?: FirstScene;
  pots?: Pot[];
  homePhoto?: string | null;
  mixAlbum?: boolean;
  phase: DayPhase;
  weather: Weather | null;
}

const SCENE_WORDS: Record<FirstScene, { label: string; line: string }> = {
  window: { label: "Window", line: "Peek through their window" },
  balcony: { label: "Balcony", line: "Stand at the railing" },
  courtyard: { label: "Courtyard", line: "Stand in the aangan" },
};

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
  const scene = data.scene ?? "window";
  const pots = data.pots ?? [];
  const home = resolveMediaUrl(data.homePhoto ?? null);
  const view = home ?? scenesFor(data.phase, data.weather?.kind ?? null)[0]?.src ?? "/demo/courtyard.jpg";
  return (
    <div id="window-options" className="mb-6 scroll-mt-6">
      <PotDefs />
      <p className="m-0 text-[13px] font-medium text-ink-soft">Where you stand</p>
      <div className="mt-2 grid grid-cols-3 gap-2.5" role="radiogroup" aria-label="Your first screen">
        {FIRST_SCENES.map((sc) => (
          <button key={sc} type="button" role="radio" aria-checked={scene === sc} disabled={busy} onClick={() => void save({ action: "scene", scene: sc })} className="press block text-left">
            <SceneThumb kind={sc} src={view} wall={WALL_LOOK[data.wall]} className={cn("aspect-[3/4] w-full rounded-[14px] shadow-[0_1px_2px_rgba(0,0,0,.25)] ring-1 ring-black/10", scene === sc && "outline outline-2 outline-offset-[3px] outline-ink")} />
            <span className="mt-1.5 block text-[14px] font-semibold">{SCENE_WORDS[sc].label}</span>
            <span className="block text-[11.5px] leading-tight text-ink-soft">{SCENE_WORDS[sc].line}</span>
          </button>
        ))}
      </div>

      <HomePhoto data={data} busy={busy} save={save} />

      <p className="m-0 mt-5 text-[13px] font-medium text-ink-soft">Flower pots · up to three</p>
      <div className="mt-2 grid grid-cols-3 gap-2" role="group" aria-label="Flower pots">
        {POTS.map((pt) => {
          const on = pots.includes(pt);
          const full = !on && pots.length >= 3;
          return (
            <button
              key={pt}
              type="button"
              aria-pressed={on}
              disabled={busy || full}
              onClick={() => void save({ action: "pots", pots: on ? pots.filter((x) => x !== pt) : [...pots, pt] })}
              className={cn("press relative flex flex-col items-center rounded-[14px] bg-surface pb-2 pt-2.5 disabled:opacity-55", on && "bg-white outline outline-2 outline-ink")}
            >
              <PotArt kind={pt} bloom={0.75} height={84} sway={false} />
              <span className="mt-1 text-[12.5px] font-medium">{POT_LOOK[pt].label}</span>
              {on && (
                <span className="absolute right-1.5 top-1.5 grid h-5 w-5 place-items-center rounded-full bg-ink text-white" aria-hidden="true">
                  <Icon name="check" size={12} />
                </span>
              )}
            </button>
          );
        })}
      </div>
      <p className="m-0 mt-1.5 text-[12px] text-ink-faint">They bloom when the lamp is lit and on days the family shares a voice or a photo. They never wilt.</p>

      <p className="m-0 mt-5 text-[13px] font-medium text-ink-soft">Wall colour</p>
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
      <p className="m-0 mt-1.5 text-[12px] text-ink-faint">Lime-washed paint around the window, on the courtyard walls and by the balcony door. Only you see it.</p>

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

/** The view: the living album, or a photo of their actual home (uploaded like any photo, kept in the family's private storage). */
function HomePhoto({ data, busy, save }: { data: W; busy: boolean; save: (body: unknown) => Promise<void> }) {
  const input = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const url = resolveMediaUrl(data.homePhoto ?? null);
  const pick = async (file: File) => {
    setError(null);
    if (file.size > 5 * 1024 * 1024) return setError("That photo is over 5 MB. Try a smaller one.");
    setUploading(true);
    try {
      const { mediaRef } = await processHomeImage(file);
      await save({ action: "homePhoto", ref: mediaRef });
    } catch {
      setError("Couldn't read that photo. Try another.");
    }
    setUploading(false);
  };
  return (
    <div className="mt-5">
      <p className="m-0 text-[13px] font-medium text-ink-soft">What you see</p>
      <div className="mt-2 flex items-center gap-3">
        <div className="relative h-[64px] w-[64px] shrink-0 overflow-hidden rounded-[12px] bg-surface ring-1 ring-black/10">
          {url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={url} alt="Their home" className="h-full w-full object-cover" />
          ) : (
            <span className="grid h-full w-full place-items-center text-ink-soft">
              <Icon name="cloud" size={22} />
            </span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="m-0 text-[15px]">{url ? "A photo of their home" : "The living album"}</p>
          <p className="m-0 text-[12.5px] leading-snug text-ink-soft">{url ? "Their courtyard or balcony, as it really is." : "Their sky and the family's photos, turning slowly."}</p>
        </div>
      </div>
      <div className="mt-2.5 flex flex-wrap gap-2">
        <button type="button" disabled={busy || uploading} onClick={() => input.current?.click()} className="press flex h-11 items-center gap-1.5 rounded-full bg-ink px-4 text-[14px] font-semibold text-white disabled:opacity-50">
          <Icon name="camera" size={16} /> {uploading ? "Adding…" : url ? "Change photo" : "Use a photo of their home"}
        </button>
        {url && (
          <button type="button" disabled={busy || uploading} onClick={() => void save({ action: "homePhoto", ref: null })} className="press h-11 rounded-full bg-surface px-4 text-[14px] font-semibold text-ink-soft">
            Back to the album
          </button>
        )}
      </div>
      <input ref={input} type="file" accept="image/*" className="hidden" aria-label="Photo of their home" onChange={(e) => {
        const f = e.target.files?.[0];
        e.target.value = "";
        if (f) void pick(f);
      }} />
      {url && (
        <div className="mt-3 flex min-h-[44px] items-center justify-between gap-3">
          <span>
            <span className="block text-[15px]">Mix in family photos</span>
            <span className="block text-[12px] text-ink-soft">Now and then, a family photo crossfades in</span>
          </span>
          <button
            type="button"
            role="switch"
            aria-checked={data.mixAlbum !== false}
            aria-label="Mix in family photos"
            disabled={busy}
            onClick={() => void save({ action: "homePhoto", mix: data.mixAlbum === false })}
            className={cn("relative h-[26px] w-[44px] shrink-0 rounded-full transition-colors", data.mixAlbum !== false ? "bg-ink" : "bg-black/15")}
          >
            <span className={cn("absolute top-[3px] h-5 w-5 rounded-full bg-white shadow transition-all", data.mixAlbum !== false ? "left-[21px]" : "left-[3px]")} />
          </button>
        </div>
      )}
      {error && (
        <p className="m-0 mt-2 text-[13px] text-[#c2343a]" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
