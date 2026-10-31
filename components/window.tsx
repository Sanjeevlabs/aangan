"use client";

import { m } from "framer-motion";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Knock, PresenceMoment, SafetyCheckin, WindowLayer } from "@/lib/kinds";
import { whatsappInvite } from "@/lib/invite-link";
import { resolveMediaUrl } from "@/lib/media-session";
import { callName, cardCover, memberPhoto } from "@/lib/people";
import { MOMENT_LABEL, shareableFor } from "@/lib/presence";
import { stateOf, type SafetyState } from "@/lib/safety";
import { livingAlbum, scenesFor, type AlbumSlide } from "@/lib/scenes";
import type { Card, Member } from "@/lib/schemas";
import { ALIVE_LOOK, type Alive } from "@/lib/status";
import { ago, postJson, useJson } from "@/lib/use-json";
import { useFamilyCards } from "@/lib/use-family";
import { cn } from "@/lib/utils";
import { PHASE_TINT, type DayPhase, type Weather } from "@/lib/weather";
import { timeIn } from "@/lib/zones";
import { PeoplePicker } from "./people-picker";
import { usePlayer } from "./player";
import { VoiceCode } from "./plaque";
import { useShell } from "./shell";
import { useToday } from "./today";
import { Avatar, Icon, type IconName } from "./ui/kit";
import { useViewer } from "./viewer";

// LITE (SPEC §29.1, revised 30 Oct): the whole screen is the window. A real
// landscape that matches their sky right now (or a family photo you chose),
// changing slowly like a lock screen. On it, only what matters at a glance:
// are they OK, what's waiting on you, their latest voice, what you're doing.
// Actions are icons. Kutumb opens by sliding the key.

interface WindowData {
  imageRef: string;
  far: { ids: string[]; names: string; city: string; tz: string } | null;
  weather: Weather | null;
  phase: DayPhase;
  layers: WindowLayer[];
  line: string;
  moments: { memberId: string; label: string; at: string }[];
  view: { style: "still" | "living"; cardId: string | null; madeBy: "family" | "muse" } | null;
  people: { id: string; lastActive: string | null; state: Alive }[];
  chosen?: boolean;
  joined?: boolean;
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

const SKY_ICON: Record<Weather["kind"], IconName> = { clear: "sun", clouds: "cloud", fog: "fog", rain: "rain", storm: "storm", snow: "snow" };
/** Short words under the icons (the full line is what the other home reads). */
const SHORT: Partial<Record<PresenceMoment, string>> = { commute: "On my way", "cooked-yours": "Cooked", thinking: "Miss you", work: "Work", awake: "Up" };
const MOMENT_ICON: Partial<Record<PresenceMoment, IconName>> = {
  awake: "sun",
  chai: "coffee",
  walk: "walk",
  cooking: "pot",
  prayer: "flower",
  resting: "moon",
  thinking: "heart",
  work: "briefcase",
  commute: "car",
  home: "village",
  school: "school",
  "cooked-yours": "pot",
};

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
          key={sl.src}
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

/**
 * The window itself: an arched jharokha in a lime-plaster wall, the album
 * behind the glass, its line written on the sill. Swipe or tap the edges to
 * turn the photo.
 */
function Jharokha({ album, still, layers, phase, children }: { album: ReturnType<typeof useAlbum>; still: boolean; layers: WindowLayer[]; phase: DayPhase; children?: React.ReactNode }) {
  const x0 = useRef<number | null>(null);
  return (
    <figure className="relative m-0 min-h-[150px] flex-1">
      {/* the carved frame: plaster, a thin inner moulding, a shadowed reveal */}
      <div className="absolute inset-0" style={{ borderRadius: "999px 999px 22px 22px", background: "linear-gradient(180deg,#efe9e0,#d9d0c3)", boxShadow: "0 30px 60px -24px rgba(0,0,0,.65), inset 0 1px 0 #fff" }} />
      <div
        className="absolute inset-[9px] overflow-hidden bg-[#1a1816]"
        style={{ borderRadius: "999px 999px 15px 15px", boxShadow: "inset 0 0 0 1px rgba(0,0,0,.25)", touchAction: "pan-y" }}
        onPointerDown={(e) => (x0.current = e.clientX)}
        onPointerUp={(e) => {
          if (x0.current === null) return;
          const dx = e.clientX - x0.current;
          x0.current = null;
          if (Math.abs(dx) > 40) album.go(dx < 0 ? 1 : -1);
        }}
      >
        <AlbumPhotos list={album.list} at={album.at} still={still} onFail={album.fail} />
        {!still && <SkyLayers layers={layers.filter((l) => l === "rain" || l === "breeze")} phase={phase} tint={false} />}
        {/* depth: the reveal of the wall, and a soft floor for the caption */}
        <div className="pointer-events-none absolute inset-0" style={{ borderRadius: "inherit", boxShadow: "inset 0 18px 28px -14px rgba(0,0,0,.45), inset 14px 0 26px -18px rgba(0,0,0,.5), inset -14px 0 26px -18px rgba(0,0,0,.5)", background: "linear-gradient(to bottom, transparent 62%, rgba(0,0,0,.55))" }} />
        {/* a mullion: two panes, like a real window */}
        <div className="pointer-events-none absolute inset-y-0 left-1/2 w-[3px] -translate-x-1/2 bg-[#e7e0d5]/80 shadow-[0_0_6px_rgba(0,0,0,.3)]" />
        {album.cur && (
          <figcaption className="absolute inset-x-4 bottom-3 flex items-end gap-2 text-white">
            <span className="min-w-0 flex-1 [text-shadow:0_1px_8px_rgba(0,0,0,.5)]">
              <span className="voice line-clamp-2 block text-[15px] leading-snug">{album.cur.title}</span>
              {album.cur.by && <span className="block text-[11.5px] text-white/75">{album.cur.by}</span>}
            </span>
            {album.list.length > 1 && (
              <span className="flex shrink-0 gap-1 pb-1" aria-hidden="true">
                {album.list.slice(0, 8).map((sl, k) => (
                  <span key={sl.src} className={cn("block h-1 rounded-full transition-all", k === album.at % 8 ? "w-3 bg-white" : "w-1 bg-white/45")} />
                ))}
              </span>
            )}
          </figcaption>
        )}
        {album.list.length > 1 && (
          <>
            <button type="button" aria-label="Previous photo" onClick={() => album.go(-1)} className="absolute inset-y-0 left-0 w-[22%]" />
            <button type="button" aria-label="Next photo" onClick={() => album.go(1)} className="absolute inset-y-0 right-0 w-[22%]" />
          </>
        )}
        {children}
      </div>
    </figure>
  );
}

/* ------------------------------------------------------- slide to open */
/** Slide the key to open Kutumb (or press Enter on the key). */
function SlideToOpen({ onOpen }: { onOpen: () => void }) {
  const track = useRef<HTMLDivElement>(null);
  const start = useRef<number | null>(null);
  const [x, setX] = useState(0);
  const [done, setDone] = useState(false);
  const KNOB = 44;
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
    <div ref={track} className="relative h-[52px] min-w-0 flex-1 select-none overflow-hidden rounded-full bg-white/10" style={{ touchAction: "none" }}>
      <span className="pointer-events-none absolute inset-0 flex items-center justify-center pl-12 text-[15px] font-medium tracking-[0.22em] text-white" style={{ opacity: 1 - p * 1.6 }}>
        <span className="lite-shimmer uppercase">Kutumb</span>
        <Icon name="chevron" size={15} className="ml-1 opacity-70" />
        <Icon name="chevron" size={15} className="-ml-2 opacity-40" />
      </span>
      <span className="pointer-events-none absolute inset-y-0 left-0 rounded-full bg-white/20" style={{ width: x + KNOB + 8 }} aria-hidden="true" />
      <button
        type="button"
        aria-label="Slide to open Kutumb, the whole family"
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
        className="absolute left-1 top-1 grid place-items-center rounded-full bg-white text-black shadow-[0_6px_18px_rgba(0,0,0,.35)]"
        style={{ width: KNOB, height: KNOB, transform: `translateX(${x}px)`, transition: start.current === null ? "transform 260ms cubic-bezier(.2,.9,.3,1.2)" : "none" }}
      >
        <m.span animate={done ? { rotate: 90 } : { rotate: 0 }} transition={{ duration: 0.2 }}>
          <Icon name={done ? "lockOpen" : "key"} size={22} strokeWidth={2} />
        </m.span>
      </button>
    </div>
  );
}

/* ---------------------------------------------------------------- LITE */
export function LiteWindow({ onOpenDoor }: { onOpenDoor: () => void }) {
  const router = useRouter();
  const { viewer, members } = useViewer();
  const { openAdd, openRoom, refreshKey } = useShell();
  const win = useJson<WindowData>("/api/window");
  const sit = useJson<{ knocks: Knock[] }>("/api/sit");
  const safety = useJson<{ checkins: SafetyCheckin[] }>("/api/safety");
  const { cards } = useFamilyCards(refreshKey);
  const [clock, setClock] = useState<string>("");
  const [calling, setCalling] = useState(false);
  const [picking, setPicking] = useState(false);
  const [worry, setWorry] = useState<Member | null>(null);
  const [welcome, setWelcome] = useState<string | null>(null);
  const data = win.data;
  const farIds = useMemo(() => new Set(data?.far?.ids ?? []), [data?.far?.ids]);
  const farPeople = members.filter((mm) => farIds.has(mm.id));
  // Whoever is on the other side: one parent, two, a guardian. Never assumed.
  const grownUps = farPeople.filter((p) => p.role !== "child");
  const talkTo = grownUps.length ? grownUps : farPeople;
  const statusOf = (id: string) => data?.people.find((p) => p.id === id);
  const waiting = Boolean(data && (!data.far || data.joined === false));

  const talk = (ids?: string[]) => {
    if (!ids && talkTo.length > 1) return setPicking(true);
    setPicking(false);
    setWorry(null);
    openAdd("voice", null, ids ?? talkTo.map((p) => p.id));
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

  // Muse writes the one quiet line once per visit (cached and grounded server-side).
  useEffect(() => {
    if (!data || data.view?.style === "still" || data.view?.madeBy === "muse") return;
    void postJson("/api/window", { action: "compose" }).then((r) => r && void win.reload());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [Boolean(data)]);

  const latestVoice: Card | undefined = (cards ?? []).find((c) => c.type === "audio" && c.authorId && farIds.has(c.authorId));
  const knock = (sit.data?.knocks ?? []).find((k) => farIds.has(k.memberId));
  const slides = useMemo<AlbumSlide[]>(() => {
    if (!data) return [];
    const own = data.chosen ? resolveMediaUrl(data.imageRef) : null;
    if (own) return [{ src: own, title: "", by: "", family: true }];
    // The family's own photos come round in the album, with their captions.
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

  // Safe & sound: the latest check-in of each person on the other side who shares with you.
  const checks = useMemo(() => {
    const all = safety.data?.checkins ?? [];
    return talkTo
      .map((p) => ({ p, s: stateOf(all, p.id) }))
      .filter((x): x is { p: Member; s: SafetyState } => Boolean(x.s) && (x.s!.tone !== "calm" || Date.now() - Date.parse(x.s!.at) < 24 * 3_600_000));
  }, [safety.data, talkTo]);

  const call = async () => {
    if (knock) return router.push(`/call/${knock.id}`);
    setCalling(true);
    const out = await postJson<{ knock: Knock }>("/api/sit", { action: "knock", minutes: 45, note: "Come sit with me" });
    setCalling(false);
    if (out?.knock) router.push(`/call/${out.knock.id}`);
  };

  return (
    <div className="fixed inset-0 z-30 overflow-hidden bg-[#0d0c0b] text-white">
      {/* The room: the same photo, blurred and dimmed, so the wall glows with the view */}
      <div className="pointer-events-none absolute inset-0 scale-125 opacity-70 blur-[40px]" aria-hidden="true">
        {data && <AlbumPhotos list={album.list} at={album.at} still onFail={() => undefined} />}
      </div>
      <div className="pointer-events-none absolute inset-0" style={{ background: "linear-gradient(to bottom, rgba(10,9,8,.35), rgba(10,9,8,.55) 45%, rgba(10,9,8,.8))" }} aria-hidden="true" />

      <div className="relative mx-auto flex h-full w-full max-w-[480px] flex-col gap-3 px-5 [@media(max-height:720px)]:gap-2" style={{ paddingTop: "calc(14px + env(safe-area-inset-top))", paddingBottom: "calc(14px + env(safe-area-inset-bottom))" }}>
        {/* Who, where, their hour, their sky */}
        <header className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="m-0 truncate text-[26px] font-light leading-[1.1] tracking-[-0.01em]">{data?.far?.names || (data ? "Your window" : " ")}</h1>
            {data?.far && (
              <p className="m-0 mt-1 flex flex-wrap items-center gap-x-2.5 text-[13.5px] text-white/80">
                <span>{data.far.city || "Their home"}</span>
                <span className="tnum" suppressHydrationWarning>
                  {clock}
                </span>
                {data.weather && (
                  <span className="flex items-center gap-1">
                    <Icon name={SKY_ICON[data.weather.kind]} size={14} /> {data.weather.tempC}°
                  </span>
                )}
              </p>
            )}
          </div>
          <button type="button" onClick={() => openRoom("all")} aria-label="Everything, and your settings" className="press shrink-0 rounded-full ring-1 ring-white/40">
            <Avatar src={memberPhoto(viewer)} name={viewer.firstName} size={40} />
          </button>
        </header>
        {welcome && <p className="voice m-0 -mt-1 text-[16px] text-white/90">{welcome}</p>}

        {/* The window: fills whatever height is left, so the screen is balanced on any phone */}
        {data ? (
          <Jharokha album={album} still={still} layers={data.layers} phase={data.phase} />
        ) : (
          <div className="min-h-[200px] flex-1 animate-pulse bg-white/10" style={{ borderRadius: "999px 999px 22px 22px" }} aria-busy="true" aria-label="Opening the window" />
        )}

        {data && waiting && <WaitingCard names={data.far?.names ?? ""} />}
        {data && !waiting && (
          <>
            <SafeGlance people={talkTo} statusOf={statusOf} checks={checks} onWorry={setWorry} onTalk={(id) => talk([id])} />
            <NextOrVoice people={talkTo} statusOf={statusOf} latestVoice={latestVoice} viewerId={viewer.id} cards={cards ?? []} onWorry={setWorry} onReply={(id) => talk([id])} onWish={(id) => openAdd("voice", null, [id])} knock={knock} />
            <Moments />
          </>
        )}

        {/* One dock: voice note · video · slide the key */}
        <nav className="lite-glass flex items-center gap-1.5 rounded-full p-1.5" aria-label="Window actions">
          <button type="button" onClick={() => talk()} disabled={waiting || !talkTo.length} aria-label={talkTo.length === 1 ? `Voice note to ${callName(talkTo[0])}` : "Voice note"} className="press grid h-[52px] w-[52px] shrink-0 place-items-center rounded-full bg-white/15 disabled:opacity-40">
            <Icon name="mic" size={22} strokeWidth={1.8} />
          </button>
          {!waiting && (
            <button type="button" onClick={() => void call()} disabled={calling} aria-label={knock ? "Join the video call" : "Video call"} className={cn("press relative grid h-[52px] w-[52px] shrink-0 place-items-center rounded-full bg-white/15", calling && "opacity-60")}>
              <Icon name="video" size={22} strokeWidth={1.8} />
              {knock && <span className="absolute right-2.5 top-2.5 h-2.5 w-2.5 animate-ping rounded-full bg-[#3ccf7a]" />}
            </button>
          )}
          <SlideToOpen onOpen={onOpenDoor} />
        </nav>
      </div>

      <PeoplePicker
        open={picking}
        title="Voice note to"
        people={talkTo}
        status={(p) => {
          const st = statusOf(p.id);
          return st ? { text: statusText(st), dot: ALIVE_LOOK[st.state].dot } : null;
        }}
        onPick={(ids) => talk(ids)}
        onClose={() => setPicking(false)}
      />
      <WorrySheet person={worry} status={worry ? statusOf(worry.id) : undefined} onTalk={() => worry && talk([worry.id])} onCall={() => void call()} onClose={() => setWorry(null)} />
    </div>
  );
}

/* -------------------------------------------------------- safe & sound */
/** Each person: a light that breathes when they've been around, amber when quiet; the latest check-in. */
function SafeGlance({
  people,
  statusOf,
  checks,
  onWorry,
  onTalk,
}: {
  people: Member[];
  statusOf: (id: string) => { lastActive: string | null; state: Alive } | undefined;
  checks: { p: Member; s: SafetyState }[];
  onWorry: (m: Member) => void;
  onTalk: (id: string) => void;
}) {
  if (!people.length) return null;
  return (
    <section aria-label="Safe and sound" className="lite-glass rounded-[24px] p-1.5">
      <ul className="no-scrollbar m-0 flex list-none gap-1 overflow-x-auto p-0">
        {people.map((p) => {
          const st = statusOf(p.id);
          const state = st?.state ?? "unknown";
          const quiet = state === "quiet";
          return (
            <li key={p.id} className="min-w-0 flex-1">
              <button type="button" onClick={() => (quiet ? onWorry(p) : onTalk(p.id))} className="press flex w-full min-w-[150px] items-center gap-2.5 rounded-[18px] p-1.5 pr-3 text-left hover:bg-white/10" aria-label={`${callName(p)}: ${st ? statusText(st) : ALIVE_LOOK[state].word}`}>
                <span className="relative shrink-0">
                  <Avatar src={memberPhoto(p)} name={callName(p)} size={40} />
                  <span className={cn("absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full ring-2 ring-black/30", state === "active" && "alive-breathe")} style={{ background: ALIVE_LOOK[state].dot, color: ALIVE_LOOK[state].dot }} />
                </span>
                <span className="min-w-0 leading-tight">
                  <span className="block truncate text-[15px] font-semibold">{callName(p)}</span>
                  <span className={cn("block truncate text-[12.5px]", quiet ? "text-[#ffd18a]" : "text-white/75")} suppressHydrationWarning>
                    {st ? statusText(st) : "…"}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      {checks.length > 0 && (
        <ul className="m-0 mt-1 list-none space-y-1 border-t border-white/15 p-0 pt-1.5">
          {checks.map(({ p, s }) => {
            const alarm = s.tone === "overdue" || s.tone === "help";
            return (
              <li key={p.id}>
                <a href="/safe" className={cn("flex items-center gap-2 rounded-[14px] px-2.5 py-1.5 text-[13px] text-white no-underline", alarm && "bg-[#e5484d]/85")}>
                  <Icon name="shield" size={15} />
                  <span className="min-w-0 flex-1 truncate">
                    <b className="font-semibold">{callName(p)}</b> · {s.label}
                    {s.tone === "pending" && "etaAt" in s ? ` · by ${timeIn(p.tz, new Date(s.etaAt))}` : ""}
                  </span>
                  <span className="shrink-0 text-white/70" suppressHydrationWarning>
                    {ago(s.at)}
                  </span>
                </a>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

/* ------------------------------------------- what's waiting · their voice */
/** One card: the thing waiting on you (if any) above their latest voice. Hidden when empty. */
function NextOrVoice(props: Parameters<typeof NextStep>[0]) {
  return (
    <section aria-label="Waiting for you" className="lite-glass rounded-[22px] p-1 empty:hidden [&>*+*]:border-t [&>*+*]:border-white/15">
      <NextStep {...props} />
      {props.latestVoice && <VoiceRow card={props.latestVoice} />}
    </section>
  );
}

/* ------------------------------------------------------------ the voice */
function VoiceRow({ card }: { card: Card }) {
  const { members } = useViewer();
  const { play, current, isPlaying, toggle } = usePlayer();
  const author = members.find((mm) => mm.id === card.authorId);
  const playing = current?.id === card.id && isPlaying;
  return (
    <button type="button" onClick={() => (current?.id === card.id ? toggle() : play(card))} className="press flex w-full items-center gap-3 rounded-[18px] p-1.5 pr-3 text-left" aria-label={`${playing ? "Pause" : "Play"} ${callName(author)}'s voice note`}>
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-white text-black">
        <Icon name={playing ? "pause" : "play"} size={17} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="voice block truncate text-[15.5px]">{card.caption || `${callName(author)}'s voice`}</span>
        <span className="mt-1 flex items-center gap-2 text-[11.5px] text-white/65">
          <span className="min-w-0 flex-1 [&_span>span]:!bg-white/70">
            <VoiceCode peaks={card.peaks} bars={28} className="h-3.5" />
          </span>
          <span className="shrink-0" suppressHydrationWarning>
            {callName(author)} · {ago(card.takenAt)}
          </span>
        </span>
      </span>
    </button>
  );
}

/* ------------------------------------------------------------- moments */
/** Tell them what you're doing: one tap, both ways (parents and children alike). */
function Moments() {
  const { viewer } = useViewer();
  const [sent, setSent] = useState<PresenceMoment | null>(null);
  const picks = shareableFor(viewer.role)
    .filter((mo) => MOMENT_ICON[mo])
    .slice(0, 5);
  return (
    <div className="flex items-start justify-between gap-1 px-0.5 pt-1" role="group" aria-label="Tell them what you're doing">
      {picks.map((mo) => (
        <m.button
          key={mo}
          type="button"
          whileTap={{ scale: 0.92 }}
          aria-pressed={sent === mo}
          aria-label={`Tell them: ${MOMENT_LABEL[mo].label}`}
          onClick={async () => {
            setSent(mo);
            await postJson("/api/presence", { moment: mo });
          }}
          className="flex w-[64px] flex-col items-center gap-1"
        >
          <span className={cn("grid h-[46px] w-[46px] place-items-center rounded-full transition-colors", sent === mo ? "bg-white text-black" : "lite-glass")}>
            <Icon name={sent === mo ? "check" : (MOMENT_ICON[mo] as IconName)} size={20} strokeWidth={1.8} />
          </span>
          <span className="max-w-full truncate text-[11px] text-white/80 [@media(max-height:720px)]:hidden">{SHORT[mo] ?? MOMENT_LABEL[mo].label}</span>
        </m.button>
      ))}
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

/**
 * The one thing worth doing now: a quiet parent beats a live call, which
 * beats an unanswered voice, which beats today's question, which beats a
 * birthday soon. Rules, not a model: instant and predictable. Nothing when
 * nothing is waiting (the screen stays calm).
 */
function NextStep({
  people,
  statusOf,
  latestVoice,
  viewerId,
  cards,
  onWorry,
  onReply,
  onWish,
  knock,
}: {
  people: Member[];
  statusOf: (id: string) => { lastActive: string | null; state: Alive } | undefined;
  latestVoice: Card | undefined;
  viewerId: string;
  cards: Card[];
  onWorry: (m: Member) => void;
  onReply: (id: string) => void;
  onWish: (id: string) => void;
  knock: Knock | undefined;
}) {
  const router = useRouter();
  const { members } = useViewer();
  const { openAdd } = useShell();
  const { data: today } = useToday();
  const quiet = people.find((p) => statusOf(p.id)?.state === "quiet");
  const myLastVoice = cards.find((c) => c.type === "audio" && c.authorId === viewerId);
  const unanswered = latestVoice && (!myLastVoice || Date.parse(latestVoice.takenAt) > Date.parse(myLastVoice.takenAt)) ? members.find((mm) => mm.id === latestVoice.authorId) : undefined;
  const task = today?.task;
  const prompt = task?.side === "parents" ? task.forParents : task?.forChildren;
  const otherIds = task ? (task.side === "parents" ? task.children : task.parents) : [];
  const answeredBy = members.find((mm) => task?.sealedBy.includes(mm.id));
  const occ = today?.occasion;
  const occPerson = occ?.memberId ? members.find((mm) => mm.id === occ.memberId) : undefined;
  const host = knock ? members.find((mm) => mm.id === knock.memberId) : undefined;

  let step: { icon: IconName; title: string; line: string; go: () => void; label: string } | null = null;
  if (quiet) {
    const st = statusOf(quiet.id);
    step = { icon: "phone", title: `Check on ${callName(quiet)}`, line: st ? statusText(st) : "", go: () => onWorry(quiet), label: `Check on ${callName(quiet)}` };
  } else if (knock) {
    step = { icon: "video", title: `${callName(host)} is on a video call`, line: "Tap to join", go: () => router.push(`/call/${knock.id}`), label: "Join the call" };
  } else if (unanswered) {
    step = { icon: "reply", title: `Reply to ${callName(unanswered)}`, line: "Their voice note is waiting", go: () => onReply(unanswered.id), label: `Reply to ${callName(unanswered)}` };
  } else if (task?.side && !task.mine && prompt) {
    step = {
      icon: "mic",
      title: answeredBy ? `${callName(answeredBy)} answered today's question` : "Today, for both homes",
      line: answeredBy ? `Answer to hear it: ${prompt}` : prompt,
      go: () => openAdd("voice", { kind: "today", taskId: task.id, prompt }, otherIds.filter((id) => id !== viewerId)),
      label: "Answer today's question",
    };
  } else if (occ && occ.days <= 3 && occPerson && occPerson.id !== viewerId) {
    step = { icon: "calendar", title: occ.days === 0 ? `${occ.title} is today` : `${occ.title} in ${occ.days} day${occ.days > 1 ? "s" : ""}`, line: "Record a wish", go: () => onWish(occPerson.id), label: "Record a wish" };
  }
  if (!step) return null;
  return (
    <button type="button" onClick={step.go} aria-label={step.label} className="press flex w-full items-center gap-3 rounded-[18px] p-1.5 pr-2 text-left">
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-white text-black">
        <Icon name={step.icon} size={18} strokeWidth={2.2} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px] font-semibold">{step.title}</span>
        <span className="block truncate text-[12.5px] text-white/70">{step.line}</span>
      </span>
      <Icon name="chevron" size={18} className="shrink-0 text-white/70" />
    </button>
  );
}
