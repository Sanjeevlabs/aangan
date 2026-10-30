"use client";

import { m } from "framer-motion";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { whatsappInvite } from "@/lib/invite-link";
import type { Knock, SafetyCheckin, Wall, WindowLayer } from "@/lib/kinds";
import { resolveMediaUrl } from "@/lib/media-session";
import { callName, cardCover, memberPhoto } from "@/lib/people";
import { stateOf, type SafetyState } from "@/lib/safety";
import { livingAlbum, scenesFor, type AlbumSlide } from "@/lib/scenes";
import type { Card, Member } from "@/lib/schemas";
import { moonShadowPath } from "@/lib/sky";
import type { DayRhythm } from "@/lib/rhythm";
import { ALIVE_LOOK, type Alive } from "@/lib/status";
import { ago, postJson, useJson } from "@/lib/use-json";
import { useFamilyCards } from "@/lib/use-family";
import { can } from "@/lib/permissions";
import { cn } from "@/lib/utils";
import { WALL_LOOK } from "@/lib/walls";
import { PHASE_TINT, type DayPhase, type Weather } from "@/lib/weather";
import { placeFromTz, timeIn } from "@/lib/zones";
import { PeoplePicker } from "./people-picker";
import { usePlayer } from "./player";
import { useShell } from "./shell";
import { Avatar, Icon } from "./ui/kit";
import { useViewer } from "./viewer";

// The window (SPEC §30.1): the first screen, with the parents at its centre.
// An arched window in a coloured wall. Inside, the living album under their
// real sky (the sun where it is, tonight's moon); the glass carries their
// weather. On the ledge, the light both homes share and their latest voice.
// Below: how they are in words against their usual day, whether now is a good
// time to call, and the key you slide home.

interface WindowData {
  imageRef: string;
  far: { ids: string[]; names: string; city: string; tz: string } | null;
  weather: Weather | null;
  phase: DayPhase;
  layers: WindowLayer[];
  line: string;
  view: { style: "still" | "living"; cardId: string | null; madeBy: "family" | "muse" } | null;
  people: { id: string; lastActive: string | null; state: Alive; line: string; rhythm: DayRhythm }[];
  chosen?: boolean;
  joined?: boolean;
  km: number | null;
  wall: Wall;
  sky: { sun: { x: number; y: number } | null; moon: { illumination: number; waxing: boolean; name: string } };
  call: { good: boolean; text: string };
}

export const WELCOME_KEY = "aangan:welcome";

/** "Active 20 min ago", "Quiet for 7 h", "Asleep". */
function statusText(p: { lastActive: string | null; state: Alive }): string {
  if (p.state === "private" || p.state === "unknown") return ALIVE_LOOK[p.state].word;
  if (!p.lastActive) return ALIVE_LOOK[p.state].word;
  const hours = Math.floor((Date.now() - Date.parse(p.lastActive)) / 3_600_000);
  if (p.state === "active") return `Active ${ago(p.lastActive)}`;
  if (p.state === "quiet") return `Quiet for ${hours} h`;
  return "Asleep";
}

/* ------------------------------------------------------------ the motion */
// Deterministic positions (no Math.random in render: server and client agree).
const spread = (n: number, seed: number) => Array.from({ length: n }, (_, i) => ((i * 61 + seed * 17) % 100) / 100);

export function SkyLayers({ layers, phase, tint = true }: { layers: WindowLayer[]; phase: DayPhase; tint?: boolean }) {
  const t = PHASE_TINT[phase];
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      {tint && <div className="absolute inset-0" style={{ background: `linear-gradient(to bottom, ${t.top}, ${t.bottom} 70%)` }} />}
      {layers.includes("stars") && (
        <div className="win-stars absolute inset-x-0 top-0 h-1/2">
          {spread(22, 3).map((x, i) => (
            <i key={i} style={{ left: `${x * 100}%`, top: `${spread(22, 9)[i] * 100}%`, animationDelay: `${(i % 7) * 0.45}s` }} />
          ))}
        </div>
      )}
      {layers.includes("clouds") && (
        <>
          <div className="win-cloud" style={{ top: "6%", width: "70%", height: "22%", animationDuration: "70s" }} />
          <div className="win-cloud" style={{ top: "18%", width: "50%", height: "16%", animationDuration: "95s", animationDelay: "-40s", opacity: 0.7 }} />
        </>
      )}
      {layers.includes("rain") && (
        <div className="win-rain absolute inset-0">
          {spread(44, 5).map((x, i) => (
            <i key={i} style={{ left: `${x * 108}%`, animationDuration: `${0.55 + (i % 5) * 0.08}s`, animationDelay: `${-(i % 11) * 0.09}s` }} />
          ))}
        </div>
      )}
      {layers.includes("leaves") && (
        <div className="win-leaves absolute inset-0">
          {spread(6, 2).map((x, i) => (
            <i key={i} style={{ left: `${x * 100}%`, animationDuration: `${9 + i * 1.7}s`, animationDelay: `${-i * 2.3}s` }} />
          ))}
        </div>
      )}
      {layers.includes("birds") && (
        <div className="win-birds absolute inset-0">
          {[0, 1, 2].map((i) => (
            <svg key={i} width="22" height="10" viewBox="0 0 22 10" style={{ top: `${12 + i * 6}%`, animationDuration: `${16 + i * 4}s`, animationDelay: `${-i * 5}s` }}>
              <path d="M1 7c3-4 6-4 10 0 4-4 7-4 10 0" stroke="rgba(30,25,20,.7)" strokeWidth="1.6" fill="none" strokeLinecap="round" />
            </svg>
          ))}
        </div>
      )}
      {layers.includes("breeze") && <div className="win-breeze absolute inset-0" />}
    </div>
  );
}

/** A small arched preview of a window (Settings). */
export function ArchWindow({ src, layers, phase, living, children, className }: { src: string; layers: WindowLayer[]; phase: DayPhase; living: boolean; children?: React.ReactNode; className?: string }) {
  return (
    <div className={cn("relative overflow-hidden", className)} style={{ borderRadius: "999px 999px 28px 28px", boxShadow: "0 30px 60px -30px rgba(0,0,0,.6), inset 0 0 0 1px rgba(255,255,255,.18)" }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt="" className={cn("absolute inset-0 h-full w-full object-cover", living && "win-drift")} />
      <SkyLayers layers={living ? layers : []} phase={phase} />
      {children}
    </div>
  );
}

/* --------------------------------------------------- the living album */
/** Which slide is showing: turns every ~14 s, skips photos that fail to load, swipe or tap to turn. */
function useAlbum(slides: AlbumSlide[], still: boolean) {
  const [i, setI] = useState(0);
  const [failed, setFailed] = useState<Set<string>>(new Set());
  const list = slides.filter((sl) => !failed.has(sl.src));
  const key = slides.map((sl) => sl.src).join("|");
  useEffect(() => setI(0), [key]);
  useEffect(() => {
    if (still || list.length < 2) return;
    const t = window.setInterval(() => setI((n) => n + 1), 14_000);
    return () => window.clearInterval(t);
  }, [still, list.length, i]);
  const at = list.length ? ((i % list.length) + list.length) % list.length : 0;
  return { list, at, cur: list[at] as AlbumSlide | undefined, go: (d: number) => setI((n) => n + d), fail: (src: string) => setFailed((f) => new Set(f).add(src)) };
}

/** Crossfading photos; the current one drifts slowly. */
function AlbumPhotos({ list, at, still, onFail }: { list: AlbumSlide[]; at: number; still: boolean; onFail: (src: string) => void }) {
  return (
    <>
      {list.map((sl, k) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={`${k}-${sl.src}`}
          src={sl.src}
          alt=""
          loading={Math.abs(k - at) <= 1 ? "eager" : "lazy"}
          onError={() => onFail(sl.src)}
          className={cn("absolute inset-0 h-full w-full object-cover transition-opacity duration-[1800ms] ease-out", k === at ? "opacity-100" : "opacity-0", !still && k === at && "win-drift")}
        />
      ))}
    </>
  );
}

/* ------------------------------------------------------- slide the key home */
/** Slide the key to the house to open home (or press Enter on the key). No words. */
function SlideHome({ onOpen }: { onOpen: () => void }) {
  const track = useRef<HTMLDivElement>(null);
  const start = useRef<number | null>(null);
  const [x, setX] = useState(0);
  const [done, setDone] = useState(false);
  const KNOB = 46;
  const max = () => Math.max(1, (track.current?.clientWidth ?? 200) - KNOB - 8);
  const finish = useCallback(() => {
    setDone(true);
    setX(max());
    try {
      navigator.vibrate?.(12);
    } catch {
      /* no haptics */
    }
    window.setTimeout(onOpen, 160);
    window.setTimeout(() => {
      setDone(false);
      setX(0);
    }, 2400);
  }, [onOpen]);
  const p = Math.min(1, x / max());
  return (
    <div ref={track} className="relative h-[56px] w-full select-none overflow-hidden rounded-full bg-ink" style={{ touchAction: "none" }}>
      <span className="pointer-events-none absolute inset-y-0 left-[64px] right-[56px] flex items-center justify-center gap-1.5 text-white/50" style={{ opacity: 1 - p * 1.4 }} aria-hidden="true">
        {[0, 1, 2].map((i) => (
          <Icon key={i} name="chevron" size={15} className="lite-shimmer-dot" />
        ))}
      </span>
      <span className="pointer-events-none absolute right-1.5 top-1.5 grid h-[44px] w-[44px] place-items-center rounded-full text-white" style={{ background: `rgba(255,255,255,${0.1 + p * 0.25})` }} aria-hidden="true">
        <Icon name="village" size={20} strokeWidth={1.8} />
      </span>
      <button
        type="button"
        aria-label="Slide the key home to open your family"
        onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), finish())}
        onPointerDown={(e) => {
          if (done) return;
          start.current = e.clientX - x;
          (e.target as HTMLElement).setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => start.current !== null && setX(Math.min(max(), Math.max(0, e.clientX - start.current)))}
        onPointerUp={() => {
          if (start.current === null) return;
          start.current = null;
          if (x / max() > 0.8) finish();
          else setX(0);
        }}
        onPointerCancel={() => {
          start.current = null;
          setX(0);
        }}
        className="absolute left-[5px] top-[5px] grid place-items-center rounded-full bg-white text-ink shadow-[0_6px_18px_rgba(0,0,0,.35)]"
        style={{ width: KNOB, height: KNOB, transform: `translateX(${x}px)`, transition: start.current === null ? "transform 260ms cubic-bezier(.2,.9,.3,1.2)" : "none" }}
      >
        <m.span animate={done ? { rotate: 90 } : { rotate: 0 }} transition={{ duration: 0.2 }}>
          <Icon name={done ? "lockOpen" : "key"} size={21} strokeWidth={2} />
        </m.span>
      </button>
    </div>
  );
}

/* --------------------------------------------------------- the real sky */
/** Sun where it really is over their home, or tonight's moon with stars. Top of the arch only. */
function RealSky({ sky, phase }: { sky: WindowData["sky"]; phase: DayPhase }) {
  const night = phase === "night" || phase === "dusk";
  const moonR = 13;
  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 h-[46%]" aria-hidden="true">
      <div className="absolute inset-0 transition-[background] duration-1000" style={{ background: night ? "linear-gradient(180deg, rgba(8,14,40,.9), rgba(8,14,40,.35) 70%, rgba(8,14,40,0))" : "linear-gradient(180deg, rgba(140,190,240,.45), rgba(255,255,255,0))" }} />
      {night && (
        <div className="win-stars absolute inset-0">
          {spread(22, 3).map((sx, i) => (
            <i key={i} style={{ left: `${sx * 100}%`, top: `${spread(22, 9)[i] * 80}%`, animationDelay: `${(i % 7) * 0.45}s` }} />
          ))}
        </div>
      )}
      {!night && sky.sun && <span className="absolute h-[34px] w-[34px] -translate-x-1/2 -translate-y-1/2 rounded-full" style={{ left: `${sky.sun.x * 100}%`, top: `${sky.sun.y * 100}%`, background: "radial-gradient(circle,#fff8e1 30%,rgba(255,236,180,0) 72%)", boxShadow: "0 0 40px 18px rgba(255,240,200,.5)" }} />}
      {night && (
        <svg className="absolute left-[64%] top-[22%]" width={moonR * 2} height={moonR * 2} viewBox={`0 0 ${moonR * 2} ${moonR * 2}`} style={{ filter: "drop-shadow(0 0 10px rgba(255,255,230,.55))" }}>
          <circle cx={moonR} cy={moonR} r={moonR} fill="#fdf6dc" />
          <path d={moonShadowPath(moonR, { phase: 0, illumination: sky.moon.illumination, waxing: sky.moon.waxing, name: sky.moon.name })} fill="rgba(10,16,44,.9)" />
        </svg>
      )}
    </div>
  );
}

/* ------------------------------------------------------- the window */
function Jharokha({ album, still, data }: { album: ReturnType<typeof useAlbum>; still: boolean; data: WindowData }) {
  const x0 = useRef<number | null>(null);
  const night = data.phase === "night" || data.phase === "dusk";
  const raining = data.weather?.kind === "rain" || data.weather?.kind === "storm";
  const caption = night && !album.cur?.family ? `Look up: ${data.far?.names.split(" & ")[0] ?? "they"} can see this same moon tonight, ${Math.round(data.sky.moon.illumination * 100)}% full` : album.cur?.title;
  return (
    <figure className="relative m-0 mx-auto h-full w-full max-w-[290px]">
      <div className="absolute inset-0" style={{ borderRadius: "999px 999px 10px 10px", background: "linear-gradient(180deg,#e8cfa8,#c9a678)", boxShadow: "0 24px 40px -18px rgba(0,0,0,.55), inset 0 0 0 2px rgba(255,255,255,.35), inset 0 0 0 9px rgba(120,80,40,.12)" }} />
      <div
        className="absolute inset-[13px] overflow-hidden bg-[#1a1816]"
        style={{ borderRadius: "999px 999px 4px 4px", touchAction: "pan-y" }}
        onPointerDown={(e) => (x0.current = e.clientX)}
        onPointerUp={(e) => {
          if (x0.current === null) return;
          const dx = e.clientX - x0.current;
          x0.current = null;
          if (Math.abs(dx) > 40) album.go(dx < 0 ? 1 : -1);
        }}
      >
        <AlbumPhotos list={album.list} at={album.at} still={still} onFail={album.fail} />
        {/* A warm room-light at night, soft daylight by day */}
        <div className="pointer-events-none absolute inset-0 transition-opacity duration-1000" style={{ background: "radial-gradient(70% 50% at 50% 100%, rgba(255,180,90,.5), transparent 70%)", mixBlendMode: "screen", opacity: night ? 1 : 0.2 }} />
        <RealSky sky={data.sky} phase={data.phase} />
        {raining && !still && <SkyLayers layers={["rain"]} phase={data.phase} tint={false} />}
        <div className="pointer-events-none absolute inset-0" style={{ boxShadow: "inset 0 16px 26px -12px rgba(0,0,0,.5), inset 12px 0 20px -14px rgba(0,0,0,.5), inset -12px 0 20px -14px rgba(0,0,0,.5)", background: "linear-gradient(transparent 58%, rgba(0,0,0,.6))" }} />
        <div className="pointer-events-none absolute inset-x-0 top-[34%] h-1" style={{ background: "linear-gradient(180deg,#b8935f,#e2c597,#b8935f)" }} />
        <div className="pointer-events-none absolute inset-y-0 left-1/2 w-1 -translate-x-1/2" style={{ background: "linear-gradient(90deg,#b8935f,#e2c597,#b8935f)" }} />
        {caption && (
          <figcaption className="voice pointer-events-none absolute inset-x-5 bottom-[58px] text-center text-[15px] leading-snug text-white [text-shadow:0_1px_8px_rgba(0,0,0,.6)]">
            {caption}
            {album.cur?.by && !night && <span className="mt-0.5 block font-sans text-[11px] not-italic text-white/80">{album.cur.by}</span>}
          </figcaption>
        )}
        {album.list.length > 1 && (
          <>
            <button type="button" aria-label="Previous photo" onClick={() => album.go(-1)} className="absolute inset-y-0 left-0 w-[22%]" />
            <button type="button" aria-label="Next photo" onClick={() => album.go(1)} className="absolute inset-y-0 right-0 w-[22%]" />
          </>
        )}
      </div>
    </figure>
  );
}

/* ------------------------------------------------- the light in the window */
interface LampData {
  lamps: { homeKey: string; memberIds: string[]; litAt: string | null; litBy: string | null; glow: number }[];
  beats: { from: string; at: string }[];
}

function Lamp({ glow, onLight, onHold, pulseKey }: { glow: number; onLight: () => void; onHold: () => void; pulseKey: number }) {
  const held = useRef<number | "held" | null>(null);
  const [rings, setRings] = useState(0);
  useEffect(() => {
    if (!pulseKey) return;
    setRings((n) => n + 1);
  }, [pulseKey]);
  const g = Math.max(0.35, Math.min(1.25, glow));
  return (
    <div className="absolute bottom-[6px] left-1/2 z-[1] -translate-x-1/2">
      <span className="lamp-halo pointer-events-none absolute left-1/2 top-[22px] h-[400px] w-[400px] -translate-x-1/2 -translate-y-1/2 rounded-full" style={{ ["--g" as string]: g } as React.CSSProperties} aria-hidden="true" />
      <span key={rings} className={cn("pointer-events-none absolute left-1/2 top-[24px] h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full", rings && "lamp-ring")} aria-hidden="true" />
      <button
        type="button"
        aria-label="Tap to light the lamp; hold to send a heartbeat"
        className="relative z-[1] block h-[56px] w-[56px]"
        onPointerDown={() => {
          held.current = window.setTimeout(() => {
            held.current = "held";
            onHold();
          }, 600);
        }}
        onPointerUp={() => {
          if (held.current === "held") return void (held.current = null);
          if (held.current !== null) window.clearTimeout(held.current);
          held.current = null;
          onLight();
        }}
        onPointerLeave={() => {
          if (typeof held.current === "number") window.clearTimeout(held.current);
          held.current = null;
        }}
        onContextMenu={(e) => e.preventDefault()}
      >
        <svg width="56" height="56" viewBox="0 0 56 56" aria-hidden="true">
          <path d="M11 38 Q28 54 45 38 Z" fill="#b98a4a" />
          <path d="M11 38 Q28 48 45 38" fill="none" stroke="#e4c48d" strokeWidth="2" />
          <g className="lamp-flame" style={{ opacity: Math.max(0.25, Math.min(1, g)) }}>
            <path d="M28 10 C34 19 34 26 28 33 C22 26 22 19 28 10 Z" fill="#ffc861" />
            <path d="M28 18 C31 23 31 27 28 31 C25 27 25 23 28 18 Z" fill="#fff4cf" />
          </g>
        </svg>
      </button>
    </div>
  );
}

/* ------------------------------------------------------- status lines */
function StatusLine({ p, st, onWorry }: { p: Member; st: WindowData["people"][number] | undefined; onWorry: () => void }) {
  const look = ALIVE_LOOK[st?.state ?? "unknown"];
  const quiet = st?.state === "quiet";
  const r = st?.rhythm;
  return (
    <button type="button" onClick={quiet ? onWorry : undefined} className={cn("grid w-full grid-cols-[34px_1fr] items-center gap-2.5 text-left", !quiet && "cursor-default")} aria-label={`${callName(p)}: ${st?.line ?? look.word}`}>
      <span className="relative">
        <Avatar src={memberPhoto(p)} name={callName(p)} size={34} />
        <span className={cn("absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full ring-2 ring-paper", st?.state === "active" && "alive-breathe")} style={{ background: look.dot, color: look.dot }} />
      </span>
      <span className="min-w-0">
        <span className="block truncate text-[13px] text-ink-soft" suppressHydrationWarning>
          <b className="font-semibold text-ink">{callName(p)}</b> · <span className={quiet ? "text-[#9a5b00]" : ""}>{st?.line ?? "…"}</span>
        </span>
        <span className="relative mt-1.5 block h-[5px] rounded-full bg-black/[.05]" aria-hidden="true">
          {r?.usual && <span className="absolute inset-y-0 rounded-full bg-black/[.09]" style={{ left: `${r.usual[0] * 100}%`, width: `${(r.usual[1] - r.usual[0]) * 100}%` }} />}
          {r?.ticks.map((t, i) => <span key={i} className="absolute inset-y-0 w-[3px] rounded-full bg-ink" style={{ left: `${t * 100}%` }} />)}
          {r?.now !== null && r?.now !== undefined && <span className="absolute -inset-y-[3px] w-[1.5px] bg-[#e5484d]" style={{ left: `${r.now * 100}%` }} />}
        </span>
      </span>
    </button>
  );
}

/* --------------------------------------------------- window settings sheet */
function WindowSheet({ open, onClose, data, onSaved }: { open: boolean; onClose: () => void; data: WindowData; onSaved: () => void }) {
  const { viewer, members } = useViewer();
  const [busy, setBusy] = useState(false);
  const chosen = data.people.map((p) => p.id);
  const others = members.filter((mm) => mm.id !== viewer.id && mm.role !== "child" && can(mm, "window.at"));
  const save = async (body: unknown) => {
    setBusy(true);
    await postJson("/api/window", body);
    setBusy(false);
    onSaved();
  };
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center" role="dialog" aria-modal="true" aria-label="Your window">
      <button type="button" aria-label="Close" className="absolute inset-0 bg-black/30" onClick={onClose} />
      <m.div className="relative max-h-[86vh] w-full max-w-[480px] overflow-y-auto rounded-t-[28px] bg-white px-5 pt-4 text-ink" style={{ paddingBottom: "calc(20px + env(safe-area-inset-bottom))" }} initial={{ y: 60, opacity: 0 }} animate={{ y: 0, opacity: 1 }}>
        <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-black/15" aria-hidden="true" />
        <p className="m-0 text-[13px] font-medium text-ink-soft">Wall</p>
        <div className="mt-2 flex gap-2.5" role="radiogroup" aria-label="Wall colour">
          {(Object.keys(WALL_LOOK) as Wall[]).map((w) => (
            <button key={w} type="button" role="radio" aria-checked={data.wall === w} aria-label={WALL_LOOK[w].label} disabled={busy} onClick={() => void save({ action: "wall", wall: w })} className={cn("h-11 w-11 rounded-full ring-1 ring-black/10", data.wall === w && "outline outline-2 outline-offset-[3px] outline-ink")} style={{ background: `linear-gradient(180deg,${WALL_LOOK[w].top},${WALL_LOOK[w].bottom})` }} />
          ))}
        </div>
        <p className="m-0 mt-5 text-[13px] font-medium text-ink-soft">Who&rsquo;s at your window · up to two</p>
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
                  className={cn("relative h-[26px] w-[44px] rounded-full transition-colors disabled:opacity-35", on ? "bg-ink" : "bg-black/15")}
                >
                  <span className={cn("absolute top-[3px] h-5 w-5 rounded-full bg-white shadow transition-all", on ? "left-[21px]" : "left-[3px]")} />
                </button>
              </li>
            );
          })}
        </ul>
        <a href="/settings#window" className="mt-3 block text-center text-[13px] text-ink-soft no-underline">
          Photo, slideshow and quiet hours
        </a>
      </m.div>
    </div>
  );
}

/* ---------------------------------------------------------------- the screen */
export function LiteWindow({ onOpenDoor }: { onOpenDoor: () => void }) {
  const router = useRouter();
  const { viewer, members } = useViewer();
  const { openAdd, openRoom, refreshKey } = useShell();
  const { play, current, isPlaying, toggle } = usePlayer();
  const win = useJson<WindowData>("/api/window");
  const lamp = useJson<LampData>("/api/lamp");
  const sit = useJson<{ knocks: Knock[] }>("/api/sit");
  const safety = useJson<{ checkins: SafetyCheckin[] }>("/api/safety");
  const { cards } = useFamilyCards(refreshKey);
  const [clock, setClock] = useState("");
  const [calling, setCalling] = useState(false);
  const [picking, setPicking] = useState(false);
  const [worry, setWorry] = useState<Member | null>(null);
  const [sheet, setSheet] = useState(false);
  const [welcome, setWelcome] = useState<string | null>(null);
  const [lampLine, setLampLine] = useState<string | null>(null);
  const [pulse, setPulse] = useState(0);
  const [litNow, setLitNow] = useState(false);
  const data = win.data;
  const farIds = useMemo(() => new Set(data?.far?.ids ?? []), [data?.far?.ids]);
  const atWindow = useMemo(() => (data?.people ?? []).map((p) => members.find((mm) => mm.id === p.id)).filter((mm): mm is Member => Boolean(mm)), [data?.people, members]);
  const statusOf = (id: string) => data?.people.find((p) => p.id === id);
  const waiting = Boolean(data && (!data.far || data.joined === false));
  const names = data?.far?.names ?? "";

  const talk = (ids?: string[]) => {
    if (!ids && atWindow.length > 1) return setPicking(true);
    setPicking(false);
    setWorry(null);
    openAdd("voice", null, ids ?? atWindow.map((p) => p.id));
  };

  useEffect(() => {
    try {
      const w = sessionStorage.getItem(WELCOME_KEY);
      if (w) {
        setWelcome(w);
        sessionStorage.removeItem(WELCOME_KEY);
      }
    } catch {
      /* private mode */
    }
  }, []);

  useEffect(() => {
    if (!data?.far) return;
    const tick = () => setClock(timeIn(data.far!.tz));
    tick();
    const t = setInterval(tick, 30_000);
    return () => clearInterval(t);
  }, [data?.far]);

  // A heartbeat waiting for you: feel it once, then it's gone.
  useEffect(() => {
    const beats = lamp.data?.beats ?? [];
    if (!beats.length) return;
    const from = members.find((mm) => mm.id === beats[beats.length - 1].from);
    setLampLine(`${callName(from)} sent you a heartbeat`);
    let n = 0;
    const iv = window.setInterval(() => {
      setPulse((k) => k + 1);
      try {
        navigator.vibrate?.([70, 120, 50]);
      } catch {
        /* no haptics */
      }
      if (++n >= 4) window.clearInterval(iv);
    }, 1000);
    void postJson("/api/lamp", { action: "felt" });
    return () => window.clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lamp.data?.beats?.length]);

  const latestVoice: Card | undefined = (cards ?? []).find((c) => c.type === "audio" && c.authorId && farIds.has(c.authorId));
  const voiceBy = members.find((mm) => mm.id === latestVoice?.authorId);
  const knock = (sit.data?.knocks ?? []).find((k) => farIds.has(k.memberId));
  const slides = useMemo<AlbumSlide[]>(() => {
    if (!data) return [];
    const own = data.chosen ? resolveMediaUrl(data.imageRef) : null;
    if (own) return [{ src: own, title: "", by: "", family: true }];
    const family = (cards ?? [])
      .filter((c) => c.type === "photo" && c.caption)
      .slice(0, 6)
      .map((c) => {
        const by = members.find((mm) => mm.id === c.authorId);
        return { src: cardCover(c, members), title: c.caption, by: [callName(by), new Date(c.takenAt).getFullYear()].filter(Boolean).join(" · ") };
      });
    return livingAlbum(scenesFor(data.phase, data.weather?.kind ?? null), family);
  }, [data, cards, members]);
  const still = data?.view?.style === "still";
  const album = useAlbum(slides, still);

  // The light between your home and theirs: whoever reached out last.
  const pair = useMemo(() => {
    const ls = lamp.data?.lamps ?? [];
    const theirs = ls.find((l) => l.memberIds.some((id) => farIds.has(id)));
    const mine = ls.find((l) => l.memberIds.includes(viewer.id));
    const last = [theirs, mine].filter((l): l is NonNullable<typeof l> => Boolean(l?.litAt)).sort((a, b) => (b.litAt ?? "").localeCompare(a.litAt ?? ""))[0];
    return { glow: Math.max(theirs?.glow ?? 0, mine?.glow ?? 0), last };
  }, [lamp.data, farIds, viewer.id]);
  const lastBy = members.find((mm) => mm.id === pair.last?.litBy);
  const defaultLampLine = pair.last?.litAt ? `${pair.last.litBy === viewer.id ? "You" : callName(lastBy)} · ${ago(pair.last.litAt)} · tap to light · hold for a heartbeat` : "Tap to light · hold for a heartbeat";

  // Safe & sound: the latest check-in of each person at the window who shares with you.
  const checks = useMemo(() => {
    const all = safety.data?.checkins ?? [];
    return atWindow.map((p) => ({ p, s: stateOf(all, p.id) })).filter((x): x is { p: Member; s: SafetyState } => Boolean(x.s) && (x.s!.tone !== "calm" || Date.now() - Date.parse(x.s!.at) < 24 * 3_600_000));
  }, [safety.data, atWindow]);

  const call = async () => {
    if (knock) return router.push(`/call/${knock.id}`);
    setCalling(true);
    const out = await postJson<{ knock: Knock }>("/api/sit", { action: "knock", minutes: 45, note: "Come sit with me" });
    setCalling(false);
    if (out?.knock) router.push(`/call/${out.knock.id}`);
  };
  const light = async () => {
    setLitNow(true);
    setPulse((k) => k + 1);
    setLampLine(`You lit it just now · it's glowing in ${data?.far?.city || "their home"}`);
    try {
      navigator.vibrate?.(10);
    } catch {
      /* no haptics */
    }
    await postJson("/api/lamp", { action: "light" });
    void lamp.reload();
  };
  const heartbeat = async () => {
    const to = atWindow[0];
    if (!to) return;
    setLampLine(`Heartbeat sent · ${callName(to)} will feel it next time they open Aangan`);
    let n = 0;
    const iv = window.setInterval(() => {
      setPulse((k) => k + 1);
      if (++n >= 4) window.clearInterval(iv);
    }, 1000);
    await postJson("/api/lamp", { action: "beat", toMemberId: to.id });
    void lamp.reload();
  };

  const look = WALL_LOOK[data?.wall ?? "jodhpur"];
  const dark = look.ink === "dark";
  const playing = latestVoice && current?.id === latestVoice.id && isPlaying;

  return (
    <div className="fixed inset-0 z-30 flex flex-col overflow-hidden bg-paper text-ink">
      {/* The wall, the window, the ledge */}
      <section
        className={cn("relative flex min-h-0 flex-[1.25] flex-col px-5 transition-[filter] duration-700", dark ? "text-ink" : "text-white")}
        style={{
          paddingTop: "calc(14px + env(safe-area-inset-top))",
          background: `radial-gradient(120% 80% at 50% 0%, rgba(255,255,255,.18), transparent 60%), linear-gradient(180deg, ${look.top}, ${look.bottom})`,
          filter: data && data.phase === "night" ? "brightness(.62) saturate(.85)" : undefined,
          ["--wall-ink-soft" as string]: dark ? "rgba(28,27,26,.7)" : "rgba(255,255,255,.9)",
        } as React.CSSProperties}
      >
        <div className="wall-grain pointer-events-none absolute inset-0" aria-hidden="true" />
        <header className="relative flex items-start justify-between gap-3">
          <div className="min-w-0 [text-shadow:0_1px_10px_rgba(0,0,0,.18)]">
            <h1 className="m-0 truncate text-[26px] font-light leading-[1.1] tracking-[-0.01em]">{names || (data ? "Your window" : " ")}</h1>
            {data?.far && (
              <p className="m-0 mt-1 flex flex-wrap items-center gap-x-2.5 text-[13px] opacity-90">
                <span>{data.far.city || "Their home"}</span>
                <span className="tnum" suppressHydrationWarning>
                  {clock}
                </span>
                {data.km && <span>{data.km.toLocaleString()} km away</span>}
              </p>
            )}
            {welcome && <p className="voice m-0 mt-1.5 text-[15px]">{welcome}</p>}
          </div>
          <button type="button" onClick={() => openRoom("all")} aria-label="Everything, and your settings" className="press shrink-0 rounded-full ring-1 ring-white/50">
            <Avatar src={memberPhoto(viewer)} name={viewer.firstName} size={40} />
          </button>
        </header>
        <div className="relative mt-3 min-h-0 flex-1">{data ? <Jharokha album={album} still={still} data={data} /> : <div className="mx-auto h-full max-w-[290px] animate-pulse bg-white/15" style={{ borderRadius: "999px 999px 10px 10px" }} aria-busy="true" aria-label="Opening the window" />}</div>
        {/* The ledge: the lamp and their latest voice */}
        <div className="relative z-[1] mx-auto mb-2 mt-[-6px] h-[16px] w-full max-w-[320px] rounded-[4px]" style={{ background: "linear-gradient(180deg,#ecd6b2,#b99567)", boxShadow: "0 10px 18px -8px rgba(0,0,0,.5)" }}>
          {!waiting && data && <Lamp glow={litNow ? 1.15 : pair.glow} onLight={() => void light()} onHold={() => void heartbeat()} pulseKey={pulse} />}
          {latestVoice && (
            <button type="button" onClick={() => (current?.id === latestVoice.id ? toggle() : play(latestVoice))} aria-label={`${playing ? "Pause" : "Play"} ${callName(voiceBy)}'s voice note`} className="absolute -top-[30px] right-2 z-[2] flex -rotate-3 items-center gap-1.5 rounded-[8px_8px_3px_3px] bg-[#fbf7ef] py-1.5 pl-1.5 pr-2.5 text-[11.5px] font-medium text-ink shadow-[0_6px_14px_-6px_rgba(0,0,0,.45)]">
              <span className="grid h-5 w-5 place-items-center rounded-full bg-ink text-white">
                <Icon name={playing ? "pause" : "play"} size={10} />
              </span>
              {callName(voiceBy)} · {ago(latestVoice.takenAt)}
            </button>
          )}
        </div>
        <p className="relative m-0 mb-3 text-center text-[11.5px] [text-shadow:0_1px_6px_rgba(0,0,0,.3)]" style={{ color: "var(--wall-ink-soft)" }} suppressHydrationWarning>
          {waiting ? " " : (lampLine ?? defaultLampLine)}
        </p>
      </section>

      {/* Inside: how they are, and the one thing to do */}
      <section className="relative flex flex-none flex-col gap-2.5 px-5 pt-3" style={{ paddingBottom: "calc(14px + env(safe-area-inset-bottom))" }}>
        {data && waiting ? (
          <WaitingCard names={names} />
        ) : (
          <>
            <div className="flex items-center justify-between">
              <p className="m-0 text-[11px] uppercase tracking-[0.14em] text-ink-soft">{atWindow.length ? `${atWindow.map((p) => callName(p)).join(" & ")} today` : "Today"}</p>
              <button type="button" onClick={() => setSheet(true)} aria-label="Your window: wall colour and who's at your window" className="grid h-8 w-8 place-items-center rounded-full text-ink-soft">
                <Icon name="settings" size={17} />
              </button>
            </div>
            {atWindow.map((p) => (
              <StatusLine key={p.id} p={p} st={statusOf(p.id)} onWorry={() => setWorry(p)} />
            ))}
            {checks.map(({ p, s }) => (
              <a key={p.id} href="/safe" className={cn("-mt-0.5 flex items-center gap-1.5 pl-[44px] text-[12px] no-underline", s.tone === "overdue" || s.tone === "help" ? "font-semibold text-[#c2343a]" : "text-ink-soft")}>
                <Icon name="shield" size={13} /> {callName(p)} · {s.label} · {ago(s.at)}
              </a>
            ))}
            <div className="my-0.5 h-px bg-[var(--line)]" />
            <div className="flex items-center gap-2.5">
              <p className="m-0 min-w-0 flex-1 text-[13.5px] leading-snug">
                {knock ? (
                  <>
                    <b className="font-semibold">{callName(members.find((mm) => mm.id === knock.memberId))} is at the window</b>
                    <span className="block text-[12px] text-ink-soft">On a video call now</span>
                  </>
                ) : (
                  <b className={cn("font-semibold", !data?.call.good && "font-normal text-ink-soft")}>{data?.call.text ?? " "}</b>
                )}
              </p>
              <button type="button" onClick={() => talk()} disabled={!atWindow.length} aria-label={atWindow.length === 1 ? `Voice note to ${callName(atWindow[0])}` : "Voice note"} className="press grid h-[46px] w-[46px] shrink-0 place-items-center rounded-full bg-black/[.06] disabled:opacity-40">
                <Icon name="mic" size={20} strokeWidth={1.9} />
              </button>
              <button type="button" onClick={() => void call()} disabled={calling} aria-label={knock ? "Join the video call" : "Video call"} className={cn("press relative grid h-[46px] w-[46px] shrink-0 place-items-center rounded-full bg-ink text-white", calling && "opacity-60")}>
                <Icon name="video" size={20} strokeWidth={1.9} />
                {knock && <span className="absolute right-1.5 top-1.5 h-2.5 w-2.5 animate-ping rounded-full bg-[#3ccf7a]" />}
              </button>
            </div>
          </>
        )}
        <SlideHome onOpen={onOpenDoor} />
      </section>

      <PeoplePicker
        open={picking}
        title="Voice note to"
        people={atWindow}
        status={(p) => {
          const st = statusOf(p.id);
          return st ? { text: st.line, dot: ALIVE_LOOK[st.state].dot } : null;
        }}
        onPick={(ids) => talk(ids)}
        onClose={() => setPicking(false)}
      />
      {data && <WindowSheet open={sheet} onClose={() => setSheet(false)} data={data} onSaved={() => void win.reload()} />}
      <WorrySheet person={worry} status={worry ? statusOf(worry.id) : undefined} onTalk={() => worry && talk([worry.id])} onCall={() => void call()} onClose={() => setWorry(null)} />
    </div>
  );
}

/* ------------------------------------------------------- empty window */
/** Nobody from the other side has joined yet: the window waits, the invite is one tap. */
function WaitingCard({ names }: { names: string }) {
  const [busy, setBusy] = useState(false);
  const send = async () => {
    setBusy(true);
    let code: string | null = null;
    try {
      const res = await fetch("/api/invites", { cache: "no-store" });
      const d = (await res.json()) as { invites?: { code: string; expiresAt: string }[] };
      code = (d.invites ?? []).find((i) => Date.parse(i.expiresAt) > Date.now())?.code ?? null;
      if (!code) {
        const made = await postJson<{ invite?: { code: string } }>("/api/invites", {});
        code = made?.invite?.code ?? null;
      }
    } catch {
      code = null;
    }
    setBusy(false);
    if (!code) return void (window.location.href = "/settings#invite");
    window.open(whatsappInvite(window.location.origin, code), "_blank", "noopener");
  };
  return (
    <section className="lite-glass rounded-[26px] p-5" aria-label="Waiting for them to join">
      <p className="m-0 flex items-center gap-2 text-[12px] uppercase tracking-[0.16em] text-white/70">
        <span className="h-2 w-2 animate-pulse rounded-full bg-white/80" /> Waiting
      </p>
      <p className="m-0 mt-2 text-[21px] font-light leading-snug">{names ? `${names} hasn't opened the window yet` : "Add the people on the other side"}</p>
      <p className="m-0 mt-1 text-[14px] text-white/70">When they join, you'll see their day here and they'll see yours.</p>
      <button type="button" onClick={() => void send()} disabled={busy} className="press mt-4 flex h-12 items-center gap-2 rounded-full bg-white px-5 text-[15px] font-semibold text-black">
        <Icon name="send" size={17} /> {busy ? "Opening…" : "Send the invite again"}
      </button>
    </section>
  );
}

/* --------------------------------------------------------- worry sheet */
/** Amber: quiet for a while in their daytime. One tap to check in. */
function WorrySheet({ person, status, onTalk, onCall, onClose }: { person: Member | null; status?: { lastActive: string | null; state: Alive }; onTalk: () => void; onCall: () => void; onClose: () => void }) {
  if (!person) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center" role="dialog" aria-modal="true" aria-label={`Check on ${callName(person)}`}>
      <button type="button" aria-label="Close" className="absolute inset-0 bg-black/40" onClick={onClose} />
      <m.div className="frost relative w-full max-w-[480px] rounded-t-[32px] px-5 pt-5 text-ink" style={{ paddingBottom: "calc(18px + env(safe-area-inset-bottom))" }} initial={{ y: 60, opacity: 0 }} animate={{ y: 0, opacity: 1 }}>
        <div className="flex items-center gap-3">
          <span className="relative">
            <Avatar src={memberPhoto(person)} name={callName(person)} size={52} />
            <span className="absolute bottom-0 right-0 h-3.5 w-3.5 rounded-full ring-2 ring-white" style={{ background: ALIVE_LOOK.quiet.dot }} />
          </span>
          <div>
            <p className="m-0 text-[19px] font-semibold">{callName(person)} has been quiet</p>
            <p className="m-0 text-[14px] text-ink-soft">{status ? statusText(status) : ""} in Aangan, during their day. Probably nothing. A call settles it.</p>
          </div>
        </div>
        <div className="mt-5 flex items-center justify-center gap-4">
          <button type="button" onClick={onCall} aria-label="Video call" className="press grid h-16 w-16 place-items-center rounded-full bg-black text-white">
            <Icon name="video" size={24} />
          </button>
          <button type="button" onClick={onTalk} aria-label="Voice note" className="press grid h-16 w-16 place-items-center rounded-full bg-black/[.06] text-ink">
            <Icon name="mic" size={24} />
          </button>
          <a href="/nearby" aria-label="Trusted nearby: who to call near them" className="press grid h-16 w-16 place-items-center rounded-full bg-black/[.06] text-ink no-underline">
            <Icon name="gather" size={24} />
          </a>
        </div>
      </m.div>
    </div>
  );
}

