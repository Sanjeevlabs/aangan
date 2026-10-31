"use client";

import { m } from "framer-motion";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { whatsappInvite } from "@/lib/invite-link";
import { haptic } from "@/lib/native";
import type { FirstScene, Knock, Pot, SafetyCheckin, Wall, WindowLayer } from "@/lib/kinds";
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
import { cn } from "@/lib/utils";
import { WALL_LOOK } from "@/lib/walls";
import { bloomFrom, sharedToday } from "@/lib/pots";
import { PHASE_TINT, type DayPhase, type Weather } from "@/lib/weather";
import { timeIn } from "@/lib/zones";
import { PeoplePicker } from "./people-picker";
import { usePlayer } from "./player";
import { useShell } from "./shell";
import { Avatar, Icon } from "./ui/kit";
import { useViewer } from "./viewer";
import { PotArt, PotDefs } from "./window-pots";
import { BalconyRail, CourtyardRoom, balconyRail, camFor, project, useBox, yardDepth, yardFarWall, yardStep, yardWalls } from "./window-scenes";

// The window (SPEC §30.1): the first screen, with the parents at its centre.
// An arched window in a coloured wall. Inside, the living album under their
// real sky (the sun where it is, tonight's moon); the glass carries their
// weather. On the ledge, the light both homes share and their latest voice.
// Below: how they are in words against their usual day, whether now is a good
// time to call, and the key you slide home.
// Each viewer can stand somewhere else instead (Settings → Your first screen):
// on a balcony, or inside the courtyard (components/window-scenes.tsx); the
// view can be a photo of their actual home; up to three flower pots bloom
// with the family (components/window-pots.tsx, lib/pots.ts).

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
  scene?: FirstScene;
  pots?: Pot[];
  homePhoto?: string | null;
  mixAlbum?: boolean;
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
    <div className={cn("win-frame relative p-[6px]", className)}>
      <div className="relative h-full w-full overflow-hidden bg-[#1a1816]" style={{ borderRadius: "999px 999px 1px 1px", boxShadow: "0 0 0 1px #22140a" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt="" className={cn("absolute inset-0 h-full w-full object-cover", living && "win-drift")} />
        <SkyLayers layers={living ? layers : []} phase={phase} />
        <div className="win-glass pointer-events-none absolute inset-0" aria-hidden="true" />
        {children}
      </div>
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
    void haptic("selection");
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
      {!night && sky.sun && <span className="absolute h-[96px] w-[96px] -translate-x-1/2 -translate-y-1/2 rounded-full" style={{ left: `${sky.sun.x * 100}%`, top: `${sky.sun.y * 100}%`, background: "radial-gradient(circle, #fffef8 0 9%, rgba(255,250,232,.92) 13%, rgba(255,242,205,.45) 24%, rgba(255,236,190,.16) 42%, rgba(255,236,190,0) 68%)" }} />}
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
/**
 * Teak glazing bars: a mullion, a transom at the springing line of the arch
 * (50cqw: the arch is a half circle as wide as the glass), and a fanlight of
 * radiating bars around a small carved hub.
 */
function GlazingBars() {
  return (
    <div className="pointer-events-none absolute inset-0" aria-hidden="true">
      {[-50, 0, 50].map((deg) => (
        <span key={deg} className="win-wood win-bar absolute left-1/2 top-0 w-[6px]" style={{ height: "50cqw", marginLeft: -3, transformOrigin: "50% 100%", transform: `rotate(${deg}deg)` }} />
      ))}
      <span className="win-wood win-bar absolute bottom-0 left-1/2 w-[7px] -translate-x-1/2" style={{ top: "50cqw" }} />
      <span className="win-wood-h win-bar-h absolute inset-x-0 h-[8px]" style={{ top: "calc(50cqw - 4px)" }} />
      <span className="win-wood win-bar absolute left-1/2 h-[30px] w-[30px] -translate-x-1/2 rounded-t-full" style={{ top: "calc(50cqw - 30px)" }} />
    </div>
  );
}

function Jharokha({ album, still, data }: { album: ReturnType<typeof useAlbum>; still: boolean; data: WindowData }) {
  const potted = (data.pots ?? []).length > 0;
  const x0 = useRef<number | null>(null);
  const night = data.phase === "night" || data.phase === "dusk";
  const raining = data.weather?.kind === "rain" || data.weather?.kind === "storm";
  const caption = night && !album.cur?.family ? `Look up: ${data.far?.names.split(" & ")[0] ?? "they"} can see this same moon tonight, ${Math.round(data.sky.moon.illumination * 100)}% full` : album.cur?.title;
  return (
    <figure className="relative m-0 mx-auto h-full w-full max-w-[310px]">
      {/* Plaster surround, the reveal (wall thickness), the carved teak frame with its bead and rebate */}
      <div className="win-surround absolute inset-0" aria-hidden="true" />
      <div className="win-reveal absolute inset-x-[11px] bottom-0 top-[11px]" aria-hidden="true" />
      <div className="win-wood win-frame absolute inset-x-[17px] bottom-[2px] top-[17px]" aria-hidden="true" />
      <div className="win-bead pointer-events-none absolute inset-x-[23px] bottom-[8px] top-[23px]" aria-hidden="true" />
      <div className="win-rebate absolute inset-x-[29px] bottom-[14px] top-[29px]" aria-hidden="true" />
      <div
        className="absolute inset-x-[31px] bottom-[16px] top-[31px] overflow-hidden bg-[#1a1816]"
        style={{ borderRadius: "999px 999px 1px 1px", touchAction: "pan-y", containerType: "inline-size" }}
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
        <div className="pointer-events-none absolute inset-0" style={{ background: "linear-gradient(transparent 60%, rgba(0,0,0,.55))" }} />
        <GlazingBars />
        <div className="win-glass pointer-events-none absolute inset-0" style={{ borderRadius: "inherit", opacity: night ? 0.55 : 1 }} aria-hidden="true" />
        {caption && (
          <figcaption className={cn("voice pointer-events-none absolute inset-x-5 text-center text-[15px] leading-snug text-white [text-shadow:0_1px_8px_rgba(0,0,0,.6)]", potted ? "bottom-[78px]" : "bottom-[58px]")}>
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

/* --------------------------------------------- the balcony and the courtyard */
type Spot = { x: number; y: number; k: number };

/** Up to three pots, nearest drawn last. `slots` are where they stand on screen. */
function Pots({ pots, bloom, slots, size }: { pots: Pot[]; bloom: number; slots: Spot[]; size: number }) {
  const placed = pots.slice(0, 3).map((kind, i) => ({ kind, at: slots[i], i })).filter((p): p is { kind: Pot; at: Spot; i: number } => Boolean(p.at));
  placed.sort((a, b) => a.at.k - b.at.k);
  return (
    <>
      {placed.map(({ kind, at, i }) => {
        const hgt = size * at.k;
        return <PotArt key={`${kind}-${i}`} kind={kind} bloom={bloom} height={hgt} delay={i * 2.3} className="pointer-events-none absolute" style={{ left: at.x - (hgt * 50) / 130, top: at.y - hgt * 0.975 }} />;
      })}
    </>
  );
}

/**
 * Standing on a balcony or inside the courtyard: the view (the living album,
 * or their home photo) fills the open middle under their real sky; the room
 * is drawn over it in perspective; the lamp stands on the rail or a step.
 */
function OpenScene({
  kind,
  album,
  still,
  data,
  pots,
  bloom,
  glow,
  lamp,
  voice,
}: {
  kind: "balcony" | "courtyard";
  glow: number;
  album: ReturnType<typeof useAlbum>;
  still: boolean;
  data: WindowData;
  pots: Pot[];
  bloom: number;
  lamp: (at: { x: number; y: number }) => React.ReactNode;
  voice: (style: React.CSSProperties) => React.ReactNode;
}) {
  const [ref, box] = useBox<HTMLDivElement>();
  const x0 = useRef<number | null>(null);
  const night = data.phase === "night" || data.phase === "dusk";
  const raining = data.weather?.kind === "rain" || data.weather?.kind === "storm";
  const caption = night && !album.cur?.family ? `Look up: ${data.far?.names.split(" & ")[0] ?? "they"} can see this same moon tonight, ${Math.round(data.sky.moon.illumination * 100)}% full` : album.cur?.title;
  const cam = box.w && box.h ? camFor(box.w, box.h) : null;
  let lampAt: { x: number; y: number } | null = null;
  let voiceAt: React.CSSProperties = {};
  let captionBottom = 120;
  let slots: Spot[] = [];
  if (cam) {
    const { w, h } = cam;
    if (kind === "balcony") {
      const r = balconyRail(cam);
      lampAt = { x: w * 0.42, y: r.topY - 2 * r.k };
      voiceAt = { right: 18, top: r.topY - 4 * r.k - 27 };
      captionBottom = h - r.topY + 46;
      slots = [project(cam, w - 54, h, -36), project(cam, 62, h, -40), project(cam, w - 112, h, -84)];
    } else {
      const st = yardStep(cam);
      const walls = yardWalls(cam);
      const top = project(cam, (st.x0 + st.x1) / 2, h - st.hgt, st.z0 - st.d / 2);
      lampAt = { x: top.x, y: top.y };
      voiceAt = { left: Math.min(w - 132, top.x + 36), top: top.y - 30 };
      captionBottom = h - project(cam, w / 2, h - yardFarWall(cam), -yardDepth(cam)).y + 16;
      slots = [project(cam, w - 50, h, -40), project(cam, walls.l + 48, h, -560), project(cam, walls.r - 46, h, -330)];
    }
  }
  return (
    <div ref={ref} className="absolute inset-0 overflow-hidden bg-[#1a1816]">
      {/* The view: their sky over the album, or their own home */}
      <div
        className="absolute inset-0"
        style={{ touchAction: "pan-y" }}
        onPointerDown={(e) => (x0.current = e.clientX)}
        onPointerUp={(e) => {
          if (x0.current === null) return;
          const dx = e.clientX - x0.current;
          x0.current = null;
          if (Math.abs(dx) > 40) album.go(dx < 0 ? 1 : -1);
        }}
      >
        <AlbumPhotos list={album.list} at={album.at} still={still} onFail={album.fail} />
        {/* Their sun and moon over the open view; a photo of a real place keeps its own sky */}
        {!album.cur?.family && <RealSky sky={data.sky} phase={data.phase} />}
        {raining && !still && <SkyLayers layers={["rain"]} phase={data.phase} tint={false} />}
        {/* Open air: a touch of haze toward the distance, deeper at night */}
        <div className="pointer-events-none absolute inset-0" style={{ background: night ? "linear-gradient(180deg, rgba(6,10,30,.35), rgba(6,10,30,.15) 50%, rgba(0,0,0,.35))" : "linear-gradient(180deg, rgba(255,255,255,0) 30%, rgba(225,230,235,.10) 60%, rgba(0,0,0,.12))" }} />
        {album.list.length > 1 && (
          <>
            <button type="button" aria-label="Previous photo" onClick={() => album.go(-1)} className="absolute bottom-[30%] left-0 top-[24%] w-[22%]" />
            <button type="button" aria-label="Next photo" onClick={() => album.go(1)} className="absolute bottom-[30%] right-0 top-[24%] w-[22%]" />
          </>
        )}
      </div>
      {cam && (kind === "balcony" ? <BalconyRail cam={cam} night={night} /> : <CourtyardRoom cam={cam} night={night} />)}
      {caption && (
        <p className="voice pointer-events-none absolute inset-x-12 m-0 text-center text-[15px] leading-snug text-white [text-shadow:0_1px_8px_rgba(0,0,0,.7)]" style={{ bottom: captionBottom }}>
          {caption}
          {album.cur?.by && !night && <span className="mt-0.5 block font-sans text-[11px] not-italic text-white/80">{album.cur.by}</span>}
        </p>
      )}
      {cam && <Pots pots={pots} bloom={bloom} slots={slots} size={kind === "balcony" ? 104 : 112} />}
      {/* At night the lamp lights what's around it: the rail and floor, the step and the tiles */}
      {night && lampAt && <span className="pointer-events-none absolute h-[340px] w-[340px] -translate-x-1/2 -translate-y-1/2 rounded-full" style={{ left: lampAt.x + 16, top: lampAt.y - 14, mixBlendMode: "screen", opacity: 0.45 + 0.55 * Math.min(1, glow), background: "radial-gradient(circle, rgba(255,182,96,.95), rgba(255,160,70,.42) 30%, rgba(255,150,60,.12) 52%, rgba(255,150,60,0) 70%)" }} aria-hidden="true" />}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[70px]" style={{ background: "linear-gradient(180deg, rgba(0,0,0,0), rgba(0,0,0,.38))" }} aria-hidden="true" />
      {lampAt && lamp(lampAt)}
      {cam && voice(voiceAt)}
    </div>
  );
}

/** Pots on the window sill: either side of the lamp, the third a step behind. */
const SILL_SLOTS = [
  { left: "23%", scale: 1 },
  { left: "55%", scale: 1 },
  { left: "9%", scale: 0.86 },
];
function SillPots({ pots, bloom }: { pots: Pot[]; bloom: number }) {
  const placed = pots.slice(0, 3).map((kind, i) => ({ kind, i, slot: SILL_SLOTS[i] }));
  return (
    <>
      {[...placed].reverse().map(({ kind, i, slot }) => (
        <PotArt key={`${kind}-${i}`} kind={kind} bloom={bloom} height={74 * slot.scale} delay={i * 2.3} className="pointer-events-none absolute -translate-x-1/2" style={{ left: slot.left, bottom: `calc(100% - ${slot.scale < 1 ? 7 : 5}px)` }} />
      ))}
    </>
  );
}

/* ------------------------------------------------- the light in the window */
interface LampData {
  lamps: { homeKey: string; memberIds: string[]; litAt: string | null; litBy: string | null; glow: number }[];
  beats: { from: string; at: string }[];
}

/** `at`: where the diya's base stands, in px of its positioned parent (balcony rail, courtyard step). Default: on the sill. */
function Lamp({ glow, onLight, onHold, pulseKey, at }: { glow: number; onLight: () => void; onHold: () => void; pulseKey: number; at?: { x: number; y: number } }) {
  const held = useRef<number | "held" | null>(null);
  const [rings, setRings] = useState(0);
  useEffect(() => {
    if (!pulseKey) return;
    setRings((n) => n + 1);
  }, [pulseKey]);
  const g = Math.max(0.35, Math.min(1.25, glow));
  return (
    <div className={cn("absolute z-[1]", !at && "bottom-[5px] left-[40%] -translate-x-1/2")} style={at ? { left: at.x, top: at.y, transform: "translate(-50%, calc(-100% + 8px))" } : undefined}>
      <span className="lamp-halo pointer-events-none absolute left-[47px] top-[26px] h-[400px] w-[400px] -translate-x-1/2 -translate-y-1/2 rounded-full" style={{ ["--g" as string]: g } as React.CSSProperties} aria-hidden="true" />
      <span key={rings} className={cn("pointer-events-none absolute left-[47px] top-[28px] h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full", rings && "lamp-ring")} aria-hidden="true" />
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
        {/* A clay diya: fired terracotta, a little oil, a cotton wick */}
        <svg width="56" height="56" viewBox="0 0 56 56" aria-hidden="true">
          <defs>
            <radialGradient id="diya-clay" cx="40%" cy="20%" r="85%">
              <stop offset="0" stopColor="#c27a4a" />
              <stop offset=".55" stopColor="#8f4c2a" />
              <stop offset="1" stopColor="#4e2512" />
            </radialGradient>
            <radialGradient id="diya-flame" cx="50%" cy="72%" r="60%">
              <stop offset="0" stopColor="#fffbe8" />
              <stop offset=".35" stopColor="#ffe08a" />
              <stop offset=".75" stopColor="#ff9f3a" />
              <stop offset="1" stopColor="#e2551c" stopOpacity=".6" />
            </radialGradient>
          </defs>
          <ellipse cx="28" cy="47.5" rx="15" ry="2" fill="rgba(0,0,0,.35)" />
          <path d="M10 37.5 C12 46 20 48 28 48 C37 48 44 45 47.5 38 L50 35.5 C46 37 41 37.5 28 37.5 C18 37.5 13 37 10 37.5 Z" fill="url(#diya-clay)" />
          <ellipse cx="29" cy="37.2" rx="18.5" ry="2.6" fill="#3a1d0e" />
          <ellipse cx="29" cy="37" rx="16.5" ry="1.7" fill="#6b4a1c" opacity=".85" />
          <path d="M11 37.5 C17 36 40 36 50 35.5" fill="none" stroke="#d99868" strokeWidth=".8" opacity=".7" />
          <path d="M45 36.5 L47.5 33.5" stroke="#2a1608" strokeWidth="1.4" strokeLinecap="round" />
          <g className="lamp-flame" style={{ opacity: Math.max(0.25, Math.min(1, g)), transformOrigin: "46px 33px" }}>
            <path d="M46.6 14 C51 22 51.5 28 47.6 33.6 C43.6 29 43.6 22 46.6 14 Z" fill="url(#diya-flame)" />
            <path d="M47 23 C48.6 26.5 48.6 29.5 47.4 32.4 C46 30 46 26.5 47 23 Z" fill="#fffdf2" />
          </g>
        </svg>
      </button>
    </div>
  );
}

/* ------------------------------------------------------- safe & sound */
/** What each dot means, in words, next to the dot. */
const STATUS_WORD: Partial<Record<Alive, { word: string; ink: string }>> = {
  active: { word: "All good", ink: "#1e7a45" },
  quiet: { word: "Quiet for a while", ink: "#9a5b00" },
  asleep: { word: "Night-time there", ink: "var(--ink-soft)" },
};

const lowerFirst = (s: string) => (s ? s.charAt(0).toLowerCase() + s.slice(1) : s);

/** "Maa · up since 6:09 AM · active 29 min ago", then "● All good · Home safe · 2 h ago". */
function StatusLine({ p, st, check, onWorry }: { p: Member; st: WindowData["people"][number] | undefined; check: SafetyState | null; onWorry: () => void }) {
  const look = ALIVE_LOOK[st?.state ?? "unknown"];
  const quiet = st?.state === "quiet";
  const word = st ? STATUS_WORD[st.state] : undefined;
  const alarm = check && (check.tone === "overdue" || check.tone === "help");
  const head = (
    <>
      <span className="relative shrink-0">
        <Avatar src={memberPhoto(p)} name={callName(p)} size={38} />
        <span className={cn("absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full ring-2 ring-paper", st?.state === "active" && "alive-breathe")} style={{ background: look.dot, color: look.dot }} />
      </span>
      <span className="block min-w-0 text-[14px] leading-snug text-ink-soft" suppressHydrationWarning>
        <b className="font-semibold text-ink">{callName(p)}</b> · {st ? lowerFirst(st.line) : "…"}
      </span>
    </>
  );
  return (
    <div className="grid grid-cols-[38px_1fr] gap-x-3">
      {quiet ? (
        <button type="button" onClick={onWorry} className="col-span-2 grid grid-cols-[38px_1fr] items-center gap-x-3 text-left" aria-label={`${callName(p)}: ${st?.line}. Quiet for a while, tap to check on them`}>
          {head}
        </button>
      ) : (
        <div className="col-span-2 grid grid-cols-[38px_1fr] items-center gap-x-3">{head}</div>
      )}
      <p className="col-start-2 m-0 -mt-1.5 flex flex-wrap items-center gap-x-1.5 text-[12.5px] leading-snug text-ink-soft" suppressHydrationWarning>
        {word && (
          <span className="inline-flex items-center gap-1.5" style={{ color: word.ink }}>
            <span className="h-[7px] w-[7px] rounded-full" style={{ background: look.dot }} aria-hidden="true" />
            {word.word}
          </span>
        )}
        {word && check && <span aria-hidden="true">·</span>}
        {check && (
          <a href="/safe" className={cn("inline-flex items-center gap-1 no-underline", alarm ? "font-semibold text-[#c2343a]" : "text-ink-soft")}>
            <Icon name="shield" size={12} /> {check.label} · {ago(check.at)}
          </a>
        )}
      </p>
    </div>
  );
}

/* ---------------------------------------------------------------- the screen */
export function LiteWindow({ onOpenDoor }: { onOpenDoor: () => void }) {
  const router = useRouter();
  const { viewer, members } = useViewer();
  const { openAdd, refreshKey } = useShell();
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
      void haptic("light");
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
    const family = (cards ?? [])
      .filter((c) => c.type === "photo" && c.caption)
      .slice(0, 6)
      .map((c) => {
        const by = members.find((mm) => mm.id === c.authorId);
        return { src: cardCover(c, members), title: c.caption, by: [callName(by), new Date(c.takenAt).getFullYear()].filter(Boolean).join(" · "), family: true };
      });
    // A photo of their actual home: it stays, and (if they like) a family photo crossfades in now and then.
    const home = data.homePhoto ? resolveMediaUrl(data.homePhoto) : null;
    if (home) {
      const slide = { src: home, title: data.far?.city ? `Home, ${data.far.city}` : "Their home", by: "", family: true };
      return data.mixAlbum === false || !family.length ? [slide] : family.slice(0, 4).flatMap((f) => [slide, slide, f]);
    }
    const own = data.chosen ? resolveMediaUrl(data.imageRef) : null;
    if (own) return [{ src: own, title: "", by: "", family: true }];
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

  // Safe & sound: the latest check-in of each person at the window who shares
  // with you (calm ones only for a day; a missed promise stays until closed).
  const checkOf = (id: string): SafetyState | null => {
    const s = stateOf(safety.data?.checkins ?? [], id);
    return s && (s.tone !== "calm" || Date.now() - Date.parse(s.at) < 24 * 3_600_000) ? s : null;
  };

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
    void haptic("medium");
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
  const scene = data?.scene ?? "window";
  const open = scene !== "window";
  const dark = look.ink === "dark" && !open;
  const playing = latestVoice && current?.id === latestVoice.id && isPlaying;
  const pots = data?.pots ?? [];
  // The pots bloom with the family: the lamp's glow, and a voice or photo today. Never below healthy.
  const bloom = bloomFrom(litNow ? 1 : pair.glow, sharedToday(cards ?? []));

  const lampEl = (at?: { x: number; y: number }) => (!waiting && data ? <Lamp glow={litNow ? 1.15 : pair.glow} onLight={() => void light()} onHold={() => void heartbeat()} pulseKey={pulse} at={at} /> : null);
  const voiceEl = (style?: React.CSSProperties) =>
    latestVoice ? (
      <button type="button" onClick={() => (current?.id === latestVoice.id ? toggle() : play(latestVoice))} aria-label={`${playing ? "Pause" : "Play"} ${callName(voiceBy)}'s voice note`} className={cn("absolute z-[2] flex -rotate-2 items-center gap-1.5 rounded-[3px] bg-[#f6f0e3] py-1.5 pl-1.5 pr-2.5 text-[11.5px] font-medium text-ink shadow-[0_1px_1px_rgba(0,0,0,.25),2px_6px_10px_-4px_rgba(0,0,0,.45)]", !style && "-top-[27px] right-3")} style={style}>
        <span className="grid h-5 w-5 place-items-center rounded-full bg-ink text-white">
          <Icon name={playing ? "pause" : "play"} size={10} />
        </span>
        {callName(voiceBy)} · {ago(latestVoice.takenAt)}
      </button>
    ) : null;
  const header = (
    <header className="relative flex items-start justify-between gap-3">
      <div className={cn("min-w-0", dark ? "[text-shadow:0_1px_0_rgba(255,255,255,.25)]" : open ? "[text-shadow:0_1px_12px_rgba(0,0,0,.55)]" : "[text-shadow:0_1px_10px_rgba(0,0,0,.22)]")}>
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
      <button type="button" onClick={() => router.push("/settings")} aria-label="Your profile and settings" className="press shrink-0 rounded-full ring-1 ring-white/50">
        <Avatar src={memberPhoto(viewer)} name={viewer.firstName} size={40} />
      </button>
    </header>
  );
  const lampWords = waiting ? " " : (lampLine ?? defaultLampLine);

  return (
    <div className="fixed inset-0 z-30 flex flex-col overflow-hidden bg-paper text-ink">
      {/* The wall, the window, the sill */}
      <section
        className={cn("wall-paint relative flex min-h-0 flex-[1.25] flex-col transition-[filter] duration-700", open ? "px-0" : "px-5", dark ? "text-ink" : "text-white")}
        style={{
          paddingTop: open ? undefined : "calc(14px + env(safe-area-inset-top))",
          ["--wall-top" as string]: look.top,
          ["--wall-bottom" as string]: look.bottom,
          filter: data && data.phase === "night" ? "brightness(.6) saturate(.8)" : undefined,
          ["--wall-ink-soft" as string]: dark ? "rgba(28,27,26,.72)" : "rgba(255,255,255,.92)",
        } as React.CSSProperties}
      >
        <PotDefs />
        {open && data ? (
          <>
            {/* Standing on the balcony, or inside the courtyard */}
            <OpenScene kind={scene as "balcony" | "courtyard"} album={album} still={still} data={data} pots={pots} bloom={bloom} glow={litNow ? 1 : pair.glow} lamp={(at) => lampEl(at)} voice={(st) => voiceEl(st)} />
            <div className="scene-scrim pointer-events-none absolute inset-x-0 top-0 h-[150px]" aria-hidden="true" />
            <div className="relative z-[3] px-5" style={{ paddingTop: "calc(14px + env(safe-area-inset-top))" }}>
              {header}
            </div>
            <p className="pointer-events-none absolute inset-x-0 bottom-2.5 z-[3] mx-auto m-0 max-w-[210px] text-center text-[11.5px] leading-snug text-white/95 [text-shadow:0_1px_6px_rgba(0,0,0,.75)]" suppressHydrationWarning>
              {lampWords}
            </p>
          </>
        ) : (
          <>
            <div className="wall-plaster pointer-events-none absolute inset-0" aria-hidden="true" />
            {header}
            <div className="relative mt-3 min-h-0 flex-1">{data ? <Jharokha album={album} still={still} data={data} /> : <div className="win-reveal mx-auto h-full max-w-[310px] animate-pulse" aria-busy="true" aria-label="Opening the window" />}</div>
            {/* The sill: a teak board. The pots, the lamp and their latest voice sit on it. */}
            <div className="relative z-[1] mx-auto mb-2 mt-[-3px] h-[19px] w-full max-w-[340px]">
              <div className="win-wood-h win-sill-top absolute inset-x-0 top-0 h-[7px] [clip-path:polygon(4px_0,calc(100%-4px)_0,100%_100%,0_100%)]" aria-hidden="true">
                <span className="absolute inset-0 bg-[rgba(255,236,205,.16)]" />
              </div>
              <div className="win-wood-h win-sill-face absolute inset-x-0 bottom-0 top-[7px]" aria-hidden="true">
                <span className="absolute inset-0 rounded-[inherit] bg-[rgba(30,14,4,.18)]" />
              </div>
              <SillPots pots={pots} bloom={bloom} />
              {lampEl()}
              {voiceEl()}
            </div>
            <p className="relative m-0 mb-3 text-center text-[11.5px]" style={{ color: "var(--wall-ink-soft)", textShadow: dark ? "0 1px 0 rgba(255,255,255,.3)" : "0 1px 6px rgba(0,0,0,.3)" }} suppressHydrationWarning>
              {lampWords}
            </p>
          </>
        )}
      </section>

      {/* Inside: are they safe and sound, and the one thing to do */}
      <section className="relative flex flex-none flex-col gap-2.5 px-5 pt-3" style={{ paddingBottom: "calc(14px + env(safe-area-inset-bottom))" }}>
        {data && waiting ? (
          <WaitingCard names={names} />
        ) : (
          <>
            <div>
              <div className="-my-2.5 flex items-center justify-between gap-3">
                <h2 className="m-0 text-[17px] font-semibold leading-tight tracking-[-0.01em]">Safe &amp; sound</h2>
                <a href="/safe" className="-mr-2 flex min-h-[44px] shrink-0 items-center gap-0.5 px-2 text-[13px] font-medium text-ink-soft no-underline">
                  See check-ins <Icon name="chevron" size={14} />
                </a>
              </div>
              <p className="m-0 mt-0.5 text-[12px] leading-snug text-ink-soft">From when they last opened Aangan and checked in</p>
            </div>
            {atWindow.map((p) => (
              <StatusLine key={p.id} p={p} st={statusOf(p.id)} check={checkOf(p.id)} onWorry={() => setWorry(p)} />
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

