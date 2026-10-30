"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { CareSettings, Presence } from "@/lib/kinds";
import { resolveMediaUrl } from "@/lib/media-session";
import { callName, cardCover, relativeDay } from "@/lib/people";
import type { Card, Member } from "@/lib/schemas";
import { useDisplayText } from "@/lib/use-display-text";
import { ago } from "@/lib/use-json";
import { cn } from "@/lib/utils";
import { placeFromTz, timeIn } from "@/lib/zones";
import { usePlayer } from "./player";
import { sendBlessing } from "./reactions";
import { useShell } from "./shell";
import { Icon, Photo } from "./ui/kit";
import { useViewer } from "./viewer";

// Their day (SPEC §30.2): tap someone in the Everyone row and see today's (or
// their latest day's) photos, videos and voices in order, tapping through.
// No likes, no "seen", nothing expires: it is all kept in Memory Lane.

/* ------------------------------------------------------------ pure helpers */

function localDay(iso: string, tz: string): string {
  try {
    return new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(iso));
  } catch {
    return iso.slice(0, 10);
  }
}

/** Their shared things from today (their local day), else from their latest day; oldest first. */
export function dayOf(member: Pick<Member, "id" | "tz">, cards: Card[], now = new Date()): { items: Card[]; today: boolean } {
  const mine = cards.filter((c) => c.authorId === member.id && Date.parse(c.takenAt) <= now.getTime());
  if (!mine.length) return { items: [], today: false };
  const latest = mine.reduce((a, b) => (a.takenAt > b.takenAt ? a : b));
  const day = localDay(latest.takenAt, member.tz);
  const items = mine.filter((c) => localDay(c.takenAt, member.tz) === day).sort((a, b) => a.takenAt.localeCompare(b.takenAt));
  return { items, today: day === localDay(now.toISOString(), member.tz) };
}

/**
 * The lamp-glow ring: warm when they were active or shared something today
 * (their local day). Someone who turned off "Show my lamp and activity" never
 * glows and never shows when they were last here.
 */
export function lampFor(member: Pick<Member, "id" | "tz" | "city">, data: { presence: Presence[]; settings: CareSettings[]; cards: Card[] }, now = new Date()): { glow: boolean; line: string } {
  const place = member.city || placeFromTz(member.tz);
  const shares = data.settings.find((s) => s.memberId === member.id)?.shareVisits ?? true;
  if (!shares) return { glow: false, line: place };
  const today = localDay(now.toISOString(), member.tz);
  const t = now.getTime();
  const cards = data.cards.filter((c) => c.authorId === member.id && Date.parse(c.takenAt) <= t);
  const presence = data.presence.filter((p) => p.memberId === member.id && Date.parse(p.at) <= t);
  const fresh = cards.filter((c) => localDay(c.takenAt, member.tz) === today).length;
  const activeToday = presence.some((p) => localDay(p.at, member.tz) === today);
  const last = [...cards.map((c) => c.takenAt), ...presence.map((p) => p.at)].sort().pop();
  const glow = fresh > 0 || activeToday;
  if (fresh > 0) return { glow, line: `${fresh} new` };
  if (last && t - Date.parse(last) < 48 * 3_600_000) return { glow, line: `active ${ago(last, t)}` };
  return { glow, line: place };
}

/* ------------------------------------------------------------------ viewer */

const PHOTO_MS = 6000;

function Caption({ card }: { card: Card }) {
  const { displayLang } = useViewer();
  const words = card.type === "audio" ? card.transcript || card.caption : card.caption;
  const { text } = useDisplayText(words, card.type === "audio" && card.transcript ? card.transcriptLang : card.lang, displayLang);
  if (!words) return null;
  return <p className="voice m-0 line-clamp-4 text-[21px] leading-snug">{card.type === "audio" ? <>&ldquo;{text ?? words}&rdquo;</> : (text ?? words)}</p>;
}

export function PersonDay({ member, cards, onClose }: { member: Member; cards: Card[]; onClose: () => void }) {
  const { viewer, members } = useViewer();
  const { openAdd } = useShell();
  const player = usePlayer();
  const { items, today } = dayOf(member, cards);
  const [at, setAt] = useState(0);
  const [progress, setProgress] = useState(0);
  const [blessed, setBlessed] = useState<Set<string>>(new Set());
  const videoRef = useRef<HTMLVideoElement>(null);
  const card = items[Math.min(at, items.length - 1)];
  const name = callName(member);

  const next = useCallback(() => {
    setProgress(0);
    setAt((i) => {
      if (i + 1 >= items.length) {
        onClose();
        return i;
      }
      return i + 1;
    });
  }, [items.length, onClose]);
  const prev = useCallback(() => {
    setProgress(0);
    setAt((i) => Math.max(0, i - 1));
  }, []);

  // Esc closes; arrows step.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") next();
      if (e.key === "ArrowLeft") prev();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, next, prev]);

  // Photos hold for a few seconds; voices play through the shared player.
  const cardId = card?.id;
  const cardType = card?.type;
  useEffect(() => {
    if (!cardId || cardType !== "photo") return;
    const start = Date.now();
    const t = window.setInterval(() => {
      const p = (Date.now() - start) / PHOTO_MS;
      if (p >= 1) {
        window.clearInterval(t);
        next();
      } else setProgress(p);
    }, 100);
    return () => window.clearInterval(t);
  }, [cardId, cardType, next]);

  const voicePlaying = card?.type === "audio" && player.current?.id === card.id && player.isPlaying;
  const ours = card?.type === "audio" && player.current?.id === card.id;
  const voiceP = ours && player.duration ? Math.min(1, player.currentTime / player.duration) : 0;
  useEffect(() => {
    if (ours) setProgress(voiceP);
  }, [ours, voiceP]);
  // A voice that finished moves on to the next moment.
  useEffect(() => {
    if (ours && !player.isPlaying && voiceP >= 0.999) next();
  }, [ours, player.isPlaying, voiceP, next]);

  // Leaving a voice (or the viewer) stops it.
  const playerRef = useRef(player);
  playerRef.current = player;
  useEffect(
    () => () => {
      const p = playerRef.current;
      if (p.isPlaying && p.current?.id === cardId) p.toggle();
    },
    [cardId],
  );

  const playVoice = () => {
    if (!card) return;
    if (player.current?.id === card.id) return player.toggle();
    player.play(card);
    player.collapse();
  };

  const bless = async () => {
    if (!card || blessed.has(card.id)) return;
    if (await sendBlessing(card.id, viewer.id)) setBlessed((s) => new Set(s).add(card.id));
  };

  const close = () => onClose();

  return (
    <div role="dialog" aria-modal="true" aria-label={`${name}'s day`} className="fixed inset-0 z-[60] flex justify-center bg-black text-white">
      <div className="relative h-full w-full max-w-[480px] overflow-hidden">
        {!card ? (
          <div className="grid h-full place-items-center px-8 text-center">
            <div>
              <p className="voice m-0 text-[22px]">Nothing from {name} yet.</p>
              <p className="m-0 mt-2 text-[14px] text-white/60">When they share a photo or a voice, their day appears here.</p>
            </div>
          </div>
        ) : (
          <>
            {/* the moment */}
            <div className="absolute inset-0">
              {card.type === "video" && resolveMediaUrl(card.mediaRef) ? (
                <video
                  key={card.id}
                  ref={videoRef}
                  src={resolveMediaUrl(card.mediaRef) ?? undefined}
                  poster={cardCover(card, members)}
                  autoPlay
                  playsInline
                  className="absolute inset-0 h-full w-full object-cover"
                  onTimeUpdate={(e) => setProgress(e.currentTarget.duration ? e.currentTarget.currentTime / e.currentTarget.duration : 0)}
                  onEnded={next}
                />
              ) : (
                <Photo key={card.id} src={cardCover(card, members)} alt={card.caption} sizes="480px" priority position="center 30%" className={card.type === "audio" ? "scale-110 blur-[2px] brightness-75" : undefined} />
              )}
              <div className="absolute inset-0 bg-gradient-to-b from-black/55 via-transparent to-black/85" aria-hidden="true" />
            </div>

            {/* tap zones: left = back, right = next */}
            <button type="button" onClick={prev} aria-label="Previous" className="absolute inset-y-0 left-0 z-10 w-1/3" />
            <button type="button" onClick={next} aria-label="Next" className="absolute inset-y-0 right-0 z-10 w-2/3" />

            {card.type === "audio" && (
              <div className="pointer-events-none absolute inset-x-0 top-[38%] z-20 grid place-items-center">
                <button type="button" onClick={playVoice} aria-label={voicePlaying ? "Pause" : `Play ${name}'s voice`} className="press pointer-events-auto grid h-20 w-20 place-items-center rounded-full bg-white text-black shadow-xl">
                  <Icon name={voicePlaying ? "pause" : "play"} size={30} />
                </button>
              </div>
            )}
          </>
        )}

        {/* progress bars + who */}
        <div className="absolute inset-x-0 top-0 z-30 px-3" style={{ paddingTop: "calc(10px + env(safe-area-inset-top))" }}>
          <div className="flex gap-1" aria-hidden="true">
            {items.map((c, i) => (
              <span key={c.id} className="h-[3px] flex-1 overflow-hidden rounded-full bg-white/30">
                <span className="block h-full bg-white" style={{ width: `${i < at ? 100 : i === at ? progress * 100 : 0}%` }} />
              </span>
            ))}
          </div>
          <div className="mt-3 flex items-center gap-3 px-1">
            <span className="min-w-0 flex-1">
              <span className="block text-[15px] font-semibold">{name}</span>
              <span className="block text-[12.5px] text-white/70">{today ? "Today" : card ? relativeDay(card.takenAt) : "Their day"} · {member.city || placeFromTz(member.tz)}</span>
            </span>
            <button type="button" onClick={close} aria-label="Close" className="press grid h-11 w-11 place-items-center rounded-full bg-white/15 backdrop-blur">
              <Icon name="close" size={20} />
            </button>
          </div>
        </div>

        {/* caption, time, and the two ways to answer */}
        <div className="absolute inset-x-0 bottom-0 z-30 px-5" style={{ paddingBottom: "calc(18px + env(safe-area-inset-bottom))" }}>
          {card && (
            <>
              <Caption card={card} />
              <p className="m-0 mt-2 text-[12.5px] text-white/65">
                {timeIn(member.tz, new Date(card.takenAt))} their time · kept in Memory Lane
              </p>
            </>
          )}
          <div className="mt-4 flex items-center gap-2">
            <button type="button" onClick={() => { close(); openAdd("voice", null, [member.id]); }} className="press flex h-12 flex-1 items-center justify-center gap-2 rounded-full bg-white text-[15px] font-semibold text-black">
              <Icon name="mic" size={18} />
              Reply with your voice
            </button>
            {card && (
              <button
                type="button"
                onClick={() => void bless()}
                aria-pressed={blessed.has(card.id)}
                aria-label={blessed.has(card.id) ? "Blessing sent" : `Send ${name} a blessing`}
                className={cn("press grid h-12 w-12 shrink-0 place-items-center rounded-full", blessed.has(card.id) ? "bg-[#f3c26b] text-black" : "bg-white/15 text-white backdrop-blur")}
              >
                <Icon name="bless" size={20} />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
