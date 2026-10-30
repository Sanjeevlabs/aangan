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
import { ALIVE_LOOK, type Alive } from "@/lib/status";
import type { Member } from "@/lib/schemas";
import { timeIn } from "@/lib/zones";
import { PeoplePicker } from "./people-picker";
import { usePlayer } from "./player";
import { VoiceCode } from "./plaque";
import { useShell } from "./shell";
import { useToday } from "./today";
import { Avatar, Icon, type IconName } from "./ui/kit";
import { useViewer } from "./viewer";

// LITE (SPEC §29.1): the first screen is a window into the other home. Their
// sky and hour over a photo you chose, what they shared today, their latest
// voice, whether they're OK (safe & sound at a glance), and three things to
// do: talk, video call, or open Kutumb (the whole family) behind the door.

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
}

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
  const [picking, setPicking] = useState(false);
  const [worry, setWorry] = useState<Member | null>(null);
  const data = win.data;
  const farIds = useMemo(() => new Set(data?.far?.ids ?? []), [data?.far?.ids]);
  const farPeople = members.filter((mm) => farIds.has(mm.id));
  // Whoever is on the other side: one parent, two, a guardian. Never assumed.
  const grownUps = farPeople.filter((p) => p.role !== "child");
  const talkTo = grownUps.length ? grownUps : farPeople;
  const statusOf = (id: string) => data?.people.find((p) => p.id === id);
  const elder = viewer.role === "elder";
  const talk = (ids?: string[]) => {
    if (!ids && talkTo.length > 1) return setPicking(true);
    setPicking(false);
    setWorry(null);
    openAdd("voice", null, ids ?? talkTo.map((p) => p.id));
  };

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
  const knock = (sit.data?.knocks ?? []).find((k) => farIds.has(k.memberId));
  const src = resolveMediaUrl(data?.imageRef) ?? "/demo/aangan-home.svg";

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
            <p className="m-0 text-[11.5px] font-semibold uppercase tracking-[0.16em] text-white/60">Your window to</p>
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
          <ArchWindow src={src} layers={data.layers} phase={data.phase} living={data.view?.style !== "still"} className="mt-5 aspect-[1/1] w-full">
            {/* Safe & sound at a glance: each person, green when active, amber when quiet past your threshold (Settings) in their daytime. */}
            <ul className="absolute inset-x-3 bottom-3 m-0 flex list-none flex-wrap gap-2 p-0" aria-label="Are they OK">
              {talkTo.slice(0, 3).map((p) => {
                const st = statusOf(p.id);
                const look = ALIVE_LOOK[st?.state ?? "unknown"];
                const quiet = st?.state === "quiet";
                return (
                  <li key={p.id}>
                    <button
                      type="button"
                      onClick={() => (quiet ? setWorry(p) : talk([p.id]))}
                      className={cn("glass-dark press flex items-center gap-2 rounded-full py-1 pl-1 pr-3.5 text-left", quiet && "!border-[#f5a524]/70")}
                      aria-label={`${callName(p)}: ${st ? statusText(st) : look.word}`}
                    >
                      <span className="relative">
                        <Avatar src={memberPhoto(p)} name={callName(p)} size={30} />
                        <span className={cn("absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full ring-2 ring-black/40", st?.state === "active" && "animate-pulse")} style={{ background: look.dot }} />
                      </span>
                      <span className="leading-tight">
                        <span className="block text-[13.5px] font-semibold">{callName(p)}</span>
                        <span className="block text-[11.5px] text-white/75" suppressHydrationWarning>
                          {st ? statusText(st) : "…"}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </ArchWindow>
        ) : (
          <div className="skeleton mt-5 aspect-[1/1.12] w-full" style={{ borderRadius: "999px 999px 34px 34px", opacity: 0.15 }} aria-busy="true" aria-label="Opening the window" />
        )}

        {data?.line && <p className="voice m-0 mt-4 px-1 text-center text-[17px] leading-snug text-white/90">{data.line}</p>}

        <div className="mt-4 space-y-2.5">
          <NextStep
            people={talkTo}
            statusOf={statusOf}
            latestVoice={latestVoice}
            viewerId={viewer.id}
            cards={cards ?? []}
            onWorry={setWorry}
            onReply={(id) => talk([id])}
            onWish={(id) => openAdd("voice", null, [id])}
          />
          {knock && (
            <Link href={`/call/${knock.id}`} className="glass-dark press flex items-center gap-3 rounded-[22px] px-4 py-3 text-white no-underline">
              <span className="relative grid h-10 w-10 place-items-center rounded-full bg-[#2f9e5b]">
                <Icon name="video" size={18} />
                <span className="absolute -right-0.5 -top-0.5 h-3 w-3 animate-ping rounded-full bg-[#7be3a6]" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[15.5px] font-semibold">{callName(members.find((mm) => mm.id === knock.memberId))} is on a video call</span>
                <span className="block text-[13px] text-white/70">Join them</span>
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


          {elder && <ShareMoment />}
        </div>

        <div className="flex-1" />

        {/* Talk · Video call · Kutumb */}
        <nav className="sticky z-10 -mx-5 mt-6 space-y-2.5 px-5 pb-1 pt-3" style={{ bottom: "calc(10px + env(safe-area-inset-bottom))", background: "linear-gradient(to bottom, rgba(20,16,13,0), rgba(20,16,13,.92) 28%)" }} aria-label="Window actions">
          <div className="grid grid-cols-2 gap-2.5">
            <button type="button" onClick={() => talk()} className="press flex h-[60px] items-center justify-center gap-2.5 rounded-[22px] bg-white text-[16.5px] font-semibold text-black">
              <span className="grid h-9 w-9 place-items-center rounded-full bg-marigold">
                <Icon name="mic" size={19} strokeWidth={2.2} />
              </span>
              <span className="truncate">{talkTo.length === 1 ? `Talk to ${callName(talkTo[0])}` : "Talk"}</span>
            </button>
            <button type="button" onClick={() => void call()} disabled={calling} className="press flex h-[60px] items-center justify-center gap-2.5 rounded-[22px] text-[16.5px] font-semibold text-white" style={{ background: "linear-gradient(180deg,#2fae66,#1f8a4f)" }}>
              <span className="grid h-9 w-9 place-items-center rounded-full bg-white/20">
                <Icon name="video" size={19} strokeWidth={2.2} />
              </span>
              {knock ? "Join call" : calling ? "Opening…" : "Video call"}
            </button>
          </div>
          <button type="button" onClick={onOpenDoor} aria-label="Open Kutumb, the whole family" className="press flex h-[60px] w-full items-center gap-3 rounded-[22px] px-4 text-left text-black" style={{ background: "linear-gradient(180deg,#f7c164,#e0962a)", boxShadow: "inset 0 1px 0 rgba(255,240,200,.7)" }}>
            <span className="grid h-9 w-9 place-items-center rounded-full bg-black/10">
              <Icon name="key" size={19} strokeWidth={2.2} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[17px] font-bold leading-tight">Kutumb</span>
              <span className="block truncate text-[12.5px] text-black/65">The whole family: memories, kitchen, care, everyone</span>
            </span>
            <Icon name="chevron" size={18} />
          </button>
        </nav>
      </div>
      <PeoplePicker
        open={picking}
        title="Talk to"
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
        <div className="mt-5 grid grid-cols-2 gap-2.5">
          <button type="button" onClick={onCall} className="press flex h-14 items-center justify-center gap-2 rounded-[20px] text-[16px] font-semibold text-white" style={{ background: "linear-gradient(180deg,#2fae66,#1f8a4f)" }}>
            <Icon name="video" size={19} /> Call now
          </button>
          <button type="button" onClick={onTalk} className="press flex h-14 items-center justify-center gap-2 rounded-[20px] bg-black text-[16px] font-semibold text-white">
            <Icon name="mic" size={19} /> Voice note
          </button>
        </div>
        <a href="/nearby" className="mt-3 flex h-11 items-center justify-center gap-2 text-[14px] font-semibold text-ink-soft no-underline">
          <Icon name="gather" size={16} /> People near them · trusted nearby
        </a>
      </m.div>
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

/**
 * The one thing worth doing now (SPEC §29.12), so the first screen is an
 * overview with a purpose: a quiet parent beats an unanswered voice, which
 * beats today's question, which beats a birthday soon. Rules, not a model:
 * it must be instant and predictable.
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
}: {
  people: Member[];
  statusOf: (id: string) => { lastActive: string | null; state: Alive } | undefined;
  latestVoice: Card | undefined;
  viewerId: string;
  cards: Card[];
  onWorry: (m: Member) => void;
  onReply: (id: string) => void;
  onWish: (id: string) => void;
}) {
  const { members } = useViewer();
  const { openAdd } = useShell();
  const { data: today } = useToday();
  const quiet = people.find((p) => statusOf(p.id)?.state === "quiet");
  const myLastVoice = cards.find((c) => c.type === "audio" && c.authorId === viewerId);
  const unanswered = latestVoice && (!myLastVoice || Date.parse(latestVoice.takenAt) > Date.parse(myLastVoice.takenAt)) ? members.find((m) => m.id === latestVoice.authorId) : undefined;
  const task = today?.task;
  const prompt = task?.side === "parents" ? task.forParents : task?.forChildren;
  const otherIds = task ? (task.side === "parents" ? task.children : task.parents) : [];
  const answeredBy = members.find((m) => task?.sealedBy.includes(m.id));
  const occ = today?.occasion;
  const occPerson = occ?.memberId ? members.find((m) => m.id === occ.memberId) : undefined;

  let step: { icon: IconName; tone: string; title: string; line: string; cta: string; go: () => void } | null = null;
  if (quiet) {
    const st = statusOf(quiet.id);
    step = { icon: "phone", tone: "#f5a524", title: `${callName(quiet)} has been quiet`, line: st ? statusText(st) : "", cta: "Check in", go: () => onWorry(quiet) };
  } else if (unanswered) {
    step = { icon: "reply", tone: "#e8402a", title: `${callName(unanswered)} sent you a voice note`, line: "You haven't replied yet", cta: "Reply", go: () => onReply(unanswered.id) };
  } else if (task?.side && !task.mine && prompt) {
    step = {
      icon: "mic",
      tone: "#f5a524",
      title: answeredBy ? `${callName(answeredBy)} answered today's question` : "Today, for both homes",
      line: answeredBy ? `Answer to hear it: ${prompt}` : prompt,
      cta: "Answer",
      go: () => openAdd("voice", { kind: "today", taskId: task.id, prompt }, otherIds.filter((id) => id !== viewerId)),
    };
  } else if (occ && occ.days <= 3 && occPerson && occPerson.id !== viewerId) {
    step = { icon: "calendar", tone: "#b8572b", title: occ.days === 0 ? `${occ.title} is today` : `${occ.title} in ${occ.days} day${occ.days > 1 ? "s" : ""}`, line: "Record a wish before the day", cta: "Wish", go: () => onWish(occPerson.id) };
  }
  if (!step) {
    const done = task?.mine;
    return (
      <div className="glass-dark flex items-center gap-3 rounded-[22px] px-4 py-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#2fae66]/90">
          <Icon name="check" size={18} strokeWidth={2.4} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[15px] font-semibold">All good on both sides</span>
          <span className="block truncate text-[12.5px] text-white/70">{done ? "You've answered today's question" : "Nothing waiting on you"}</span>
        </span>
      </div>
    );
  }
  return (
    <button type="button" onClick={step.go} className="glass-dark press flex w-full items-center gap-3 rounded-[22px] px-4 py-3 text-left" style={{ borderColor: `${step.tone}99` }}>
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-black" style={{ background: step.tone }}>
        <Icon name={step.icon} size={18} strokeWidth={2.4} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[11.5px] font-semibold uppercase tracking-[0.1em] text-white/60">Next</span>
        <span className="block truncate text-[15.5px] font-semibold">{step.title}</span>
        <span className="block truncate text-[12.5px] text-white/70">{step.line}</span>
      </span>
      <span className="shrink-0 rounded-full bg-white px-3.5 py-2 text-[13.5px] font-semibold text-black">{step.cta}</span>
    </button>
  );
}

