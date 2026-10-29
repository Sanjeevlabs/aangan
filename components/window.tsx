"use client";

import { m } from "framer-motion";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import type { Knock, PresenceMoment, WindowLayer } from "@/lib/kinds";
import { resolveMediaUrl } from "@/lib/media-session";
import { callName, cardCover, memberPhoto } from "@/lib/people";
import { MOMENT_LABEL, shareableFor } from "@/lib/presence";
import type { Card } from "@/lib/schemas";
import { ago, postJson, useJson } from "@/lib/use-json";
import { useFamilyCards } from "@/lib/use-family";
import { cn } from "@/lib/utils";
import { PHASE_TINT, type DayPhase, type Weather } from "@/lib/weather";
import { timeIn } from "@/lib/zones";
import { usePlayer } from "./player";
import { VoiceCode } from "./plaque";
import { useShell } from "./shell";
import { TodayCard } from "./today";
import { Avatar, Icon, type IconName } from "./ui/kit";
import { useViewer } from "./viewer";

// LITE (SPEC §29.1): the first screen is a window into the other home. Their
// sky and hour over a photo you chose, what they shared today, their latest
// voice, and three things to do: talk, call, or open the door to everything.

interface WindowData {
  imageRef: string;
  far: { ids: string[]; names: string; city: string; tz: string } | null;
  weather: Weather | null;
  phase: DayPhase;
  layers: WindowLayer[];
  line: string;
  moments: { memberId: string; label: string; at: string }[];
  view: { style: "still" | "living"; cardId: string | null; madeBy: "family" | "muse" } | null;
}

const SKY_ICON: Record<Weather["kind"], IconName> = { clear: "sun", clouds: "cloud", fog: "fog", rain: "rain", storm: "storm", snow: "snow" };

/* ------------------------------------------------------------ the motion */
// Deterministic positions (no Math.random in render: server and client agree).
const spread = (n: number, seed: number) => Array.from({ length: n }, (_, i) => ((i * 61 + seed * 17) % 100) / 100);

export function SkyLayers({ layers, phase }: { layers: WindowLayer[]; phase: DayPhase }) {
  const tint = PHASE_TINT[phase];
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      <div className="absolute inset-0" style={{ background: `linear-gradient(to bottom, ${tint.top}, ${tint.bottom} 70%)` }} />
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
      {layers.includes("steam") && (
        <div className="win-steam absolute inset-0">
          {[0, 1, 2].map((i) => (
            <i key={i} style={{ left: `${44 + i * 5}%`, animationDelay: `${i * 1.8}s` }} />
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
      {layers.includes("lamp") && <div className="win-lamp" style={{ left: "-12%", bottom: "-8%", width: "70%", height: "60%" }} />}
      {layers.includes("breeze") && <div className="win-breeze absolute inset-0" />}
    </div>
  );
}

/** The arched window: their photo, their light, the motion. */
export function ArchWindow({ src, layers, phase, living, children, className }: { src: string; layers: WindowLayer[]; phase: DayPhase; living: boolean; children?: React.ReactNode; className?: string }) {
  return (
    <div className={cn("relative overflow-hidden", className)} style={{ borderRadius: "999px 999px 34px 34px", boxShadow: "0 40px 80px -30px rgba(0,0,0,.75), inset 0 0 0 1px rgba(255,255,255,.18)" }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt="" className={cn("absolute inset-0 h-full w-full object-cover", living && "win-drift")} />
      <SkyLayers layers={living ? layers : []} phase={phase} />
      {/* The frame: a carved lip around the opening */}
      <div className="pointer-events-none absolute inset-0" style={{ borderRadius: "inherit", boxShadow: "inset 0 0 0 10px rgba(30,20,14,.35), inset 0 0 0 11px rgba(255,255,255,.12), inset 0 -60px 80px -30px rgba(0,0,0,.55)" }} />
      {children}
    </div>
  );
}

/* ---------------------------------------------------------------- LITE */
export function LiteWindow({ onOpenDoor }: { onOpenDoor: () => void }) {
  const router = useRouter();
  const { viewer, members } = useViewer();
  const { openAdd, refreshKey } = useShell();
  const { play } = usePlayer();
  const win = useJson<WindowData>("/api/window");
  const sit = useJson<{ knocks: Knock[] }>("/api/sit");
  const { cards } = useFamilyCards(refreshKey);
  const [clock, setClock] = useState<string>("");
  const [calling, setCalling] = useState(false);
  const data = win.data;
  const farIds = useMemo(() => new Set(data?.far?.ids ?? []), [data?.far?.ids]);
  const farPeople = members.filter((mm) => farIds.has(mm.id));
  const elder = viewer.role === "elder";

  useEffect(() => {
    if (!data?.far) return;
    const tick = () => setClock(timeIn(data.far!.tz));
    tick();
    const t = setInterval(tick, 30_000);
    return () => clearInterval(t);
  }, [data?.far]);

  // Muse brings the window to life once per visit (cached and grounded server-side).
  useEffect(() => {
    if (!data || data.view?.style === "still" || data.view?.madeBy === "muse") return;
    void postJson("/api/window", { action: "compose" }).then((r) => r && void win.reload());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [Boolean(data)]);

  const latestVoice: Card | undefined = (cards ?? []).find((c) => c.type === "audio" && c.authorId && farIds.has(c.authorId));
  const voiceAuthor = members.find((mm) => mm.id === latestVoice?.authorId);
  const around = (data?.moments ?? []).some((mo) => Date.now() - Date.parse(mo.at) < 3 * 3_600_000);
  const knock = (sit.data?.knocks ?? []).find((k) => farIds.has(k.memberId));
  const src = resolveMediaUrl(data?.imageRef) ?? "/demo/courtyard.jpg";

  const call = async () => {
    if (knock) return router.push(`/call/${knock.id}`);
    setCalling(true);
    const out = await postJson<{ knock: Knock }>("/api/sit", { action: "knock", minutes: 45, note: "Come sit with me" });
    setCalling(false);
    if (out?.knock) router.push(`/call/${out.knock.id}`);
  };

  return (
    <div className="lite-ground fixed inset-0 z-30 overflow-y-auto">
      {/* Ambient ground: the window's own photo, blurred, so the screen is the room. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt="" aria-hidden="true" className="pointer-events-none fixed inset-0 h-full w-full scale-125 object-cover opacity-60 blur-[48px]" />
      <div className="pointer-events-none fixed inset-0" style={{ background: "linear-gradient(to bottom, rgba(16,12,10,.35), rgba(16,12,10,.82) 70%)" }} aria-hidden="true" />

      <div className="relative mx-auto flex min-h-full w-full max-w-[480px] flex-col px-5" style={{ paddingTop: "calc(18px + env(safe-area-inset-top))", paddingBottom: "calc(24px + env(safe-area-inset-bottom))" }}>
        <header className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="m-0 text-[11.5px] font-semibold uppercase tracking-[0.16em] text-white/60">{elder ? "A window to your children" : "A window home"}</p>
            <h1 className="m-0 mt-1 truncate text-[27px] leading-[1.1] text-white">{data?.far ? `${data.far.names}` : " "}</h1>
            {data?.far && (
              <p className="m-0 mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[14px] text-white/80">
                <span className="flex items-center gap-1">
                  <Icon name="pin" size={14} /> {data.far.city || "Their home"}
                </span>
                <span aria-hidden="true">·</span>
                <span suppressHydrationWarning>{clock}</span>
                {data.weather && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span className="flex items-center gap-1">
                      <Icon name={SKY_ICON[data.weather.kind]} size={15} /> {data.weather.tempC}° {data.weather.label.toLowerCase()}
                    </span>
                  </>
                )}
              </p>
            )}
          </div>
          <Link href="/settings#window" aria-label="Choose your window" className="press shrink-0 rounded-full">
            <Avatar src={memberPhoto(viewer)} name={viewer.firstName} size={40} ring />
          </Link>
        </header>

        {/* The window */}
        {data ? (
          <ArchWindow src={src} layers={data.layers} phase={data.phase} living={data.view?.style !== "still"} className="mt-5 aspect-[1/1.12] w-full">
            {/* Who's around: their faces on the sill, lit when they shared something lately */}
            <div className="absolute inset-x-3 bottom-3 flex items-end justify-between gap-2">
              <div className="glass-dark flex min-w-0 items-center gap-2.5 rounded-full py-1.5 pl-1.5 pr-4">
                <span className="flex -space-x-2">
                  {farPeople.slice(0, 3).map((p) => (
                    <span key={p.id} className="rounded-full ring-2 ring-black/30">
                      <Avatar src={memberPhoto(p)} name={callName(p)} size={30} />
                    </span>
                  ))}
                </span>
                <span className="min-w-0 truncate text-[13.5px] font-medium">
                  {data.moments[0] ? `${callName(members.find((mm) => mm.id === data.moments[0].memberId))} ${data.moments[0].label} · ${ago(data.moments[0].at)}` : "Quiet so far today"}
                </span>
              </div>
              {around && (
                <span className="glass-dark grid h-10 w-10 shrink-0 place-items-center rounded-full text-marigold" title="Around now" aria-label="Around now">
                  <Icon name="lamp" size={18} />
                </span>
              )}
            </div>
          </ArchWindow>
        ) : (
          <div className="skeleton mt-5 aspect-[1/1.12] w-full" style={{ borderRadius: "999px 999px 34px 34px", opacity: 0.15 }} aria-busy="true" aria-label="Opening the window" />
        )}

        {data?.line && <p className="voice m-0 mt-4 px-1 text-center text-[17px] leading-snug text-white/90">{data.line}</p>}

        <div className="mt-4 space-y-2.5">
          {knock && (
            <Link href={`/call/${knock.id}`} className="glass-dark press flex items-center gap-3 rounded-[22px] px-4 py-3 text-white no-underline">
              <span className="relative grid h-10 w-10 place-items-center rounded-full bg-[#2f9e5b]">
                <Icon name="video" size={18} />
                <span className="absolute -right-0.5 -top-0.5 h-3 w-3 animate-ping rounded-full bg-[#7be3a6]" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[15.5px] font-semibold">{callName(members.find((mm) => mm.id === knock.memberId))} is sitting in the courtyard</span>
                <span className="block text-[13px] text-white/70">Join the call</span>
              </span>
              <Icon name="chevron" size={18} />
            </Link>
          )}

          {latestVoice && (
            <button type="button" onClick={() => play(latestVoice)} className="glass-dark press flex w-full items-center gap-3 rounded-[22px] p-2 pr-4 text-left" aria-label={`Play ${callName(voiceAuthor)}'s latest voice note`}>
              <span className="relative h-14 w-14 shrink-0 overflow-hidden rounded-[16px]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={cardCover(latestVoice, members)} alt="" className="h-full w-full object-cover" />
                <span className="absolute inset-0 grid place-items-center bg-black/25">
                  <Icon name="play" size={18} />
                </span>
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[12px] font-semibold uppercase tracking-[0.08em] text-white/60">A voice from home · {ago(latestVoice.takenAt)}</span>
                <span className="voice block truncate text-[16.5px]">{latestVoice.caption || `${callName(voiceAuthor)}'s voice note`}</span>
                <span className="mt-1 block opacity-80 [&_span>span]:!bg-white/70">
                  <VoiceCode peaks={latestVoice.peaks} bars={30} className="h-4" />
                </span>
              </span>
            </button>
          )}

          <TodayCard variant="line" />

          {elder && <ShareMoment />}
        </div>

        <div className="flex-1" />

        {/* Talk · Call · the door */}
        <nav className="mt-6 flex items-center gap-2" aria-label="Window actions">
          <button
            type="button"
            onClick={() => openAdd("voice", null, data?.far?.ids ?? null)}
            className="press flex h-14 flex-1 items-center gap-2.5 rounded-full bg-white pl-2 pr-5 text-[16px] font-semibold text-black"
          >
            <span className="grid h-10 w-10 place-items-center rounded-full bg-marigold">
              <Icon name="mic" size={20} strokeWidth={2.2} />
            </span>
            <span className="truncate">Talk to {farPeople.filter((p) => p.role !== "child").slice(0, 2).map((p) => callName(p)).join(" & ") || "them"}</span>
          </button>
          <button type="button" onClick={() => void call()} disabled={calling} aria-label="Video call" className="glass-dark press grid h-14 w-14 place-items-center rounded-full">
            <Icon name="video" size={22} />
          </button>
          <button type="button" onClick={onOpenDoor} aria-label="Open the door to the family courtyard" className="press flex h-14 items-center gap-2 rounded-full px-4 text-[15px] font-semibold text-black" style={{ background: "linear-gradient(180deg,#f7c164,#e0962a)" }}>
            <Icon name="key" size={20} strokeWidth={2.2} />
            Door
          </button>
        </nav>
      </div>
    </div>
  );
}

/** Parents tell the other side what they're doing, in one big tap. */
function ShareMoment() {
  const { viewer } = useViewer();
  const [sent, setSent] = useState<PresenceMoment | null>(null);
  const icon: Partial<Record<PresenceMoment, IconName>> = { awake: "sun", chai: "coffee", walk: "walk", cooking: "pot", prayer: "flower", resting: "moon", thinking: "heart" };
  const picks = shareableFor(viewer.role).filter((mo) => icon[mo]).slice(0, 4);
  return (
    <div>
      <p className="m-0 mb-2 mt-1 px-1 text-[12px] font-semibold uppercase tracking-[0.08em] text-white/60">Tell them what you're doing</p>
      <div className="grid grid-cols-4 gap-2">
        {picks.map((mo) => (
          <m.button
            key={mo}
            type="button"
            whileTap={{ scale: 0.95 }}
            onClick={async () => {
              setSent(mo);
              await postJson("/api/presence", { moment: mo });
            }}
            className={cn("glass-dark flex h-[78px] flex-col items-center justify-center gap-1.5 rounded-[20px] text-[14px] font-semibold", sent === mo && "!bg-marigold !text-black")}
          >
            <Icon name={sent === mo ? "check" : (icon[mo] as IconName)} size={22} />
            {MOMENT_LABEL[mo].label}
          </m.button>
        ))}
      </div>
    </div>
  );
}
