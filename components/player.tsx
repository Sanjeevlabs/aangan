"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { AnimatePresence, motion } from "framer-motion";
import { resolveMediaUrl } from "@/lib/media-session";
import type { Card } from "@/lib/schemas";
import { estimateSegments } from "@/lib/voice";
import { callName, cardCover, formatDuration } from "@/lib/people";
import { useShell } from "./shell";
import { Icon, Photo, PlayButton } from "./ui/kit";
import { useDisplayText } from "@/lib/use-display-text";
import { ReactionBar } from "./reactions";
import { useViewer } from "./viewer";

interface PlayerState {
  current: Card | null;
  open: boolean;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  play: (card: Card) => void;
  toggle: () => void;
  seek: (seconds: number) => void;
  expand: () => void;
  collapse: () => void;
  closePlayer: () => void;
}

const PlayerContext = createContext<PlayerState | null>(null);

export function usePlayer(): PlayerState {
  const ctx = useContext(PlayerContext);
  if (!ctx) throw new Error("usePlayer must be used inside PlayerProvider");
  return ctx;
}

function segmentsMax(card: Card): number {
  return card.segments.reduce((m, s) => Math.max(m, s.end), 0);
}

export function PlayerProvider({ children }: { children: React.ReactNode }) {
  const { viewer } = useViewer();
  const [current, setCurrent] = useState<Card | null>(null);
  const [open, setOpen] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(12);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const analyserRef = useRef<{ ctx: AudioContext; analyser: AnalyserNode } | null>(null);
  const rafRef = useRef<number | null>(null);
  const timerRef = useRef<number | null>(null);

  const url = current ? resolveMediaUrl(current.mediaRef) : null;

  const stopSimulated = useCallback(() => {
    if (timerRef.current) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const stopWaves = useCallback(() => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }, []);

  // Real audio element, created lazily for uploads with a session URL.
  useEffect(() => {
    if (!url) return;
    const audio = new Audio(url);
    audio.preload = "auto";
    const onTime = () => setCurrentTime(audio.currentTime);
    const onMeta = () => setDuration(Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : 12);
    const onEnd = () => setIsPlaying(false);
    audio.addEventListener("timeupdate", onTime);
    audio.addEventListener("loadedmetadata", onMeta);
    audio.addEventListener("ended", onEnd);
    audioRef.current = audio;
    return () => {
      audio.pause();
      audio.removeEventListener("timeupdate", onTime);
      audio.removeEventListener("loadedmetadata", onMeta);
      audio.removeEventListener("ended", onEnd);
      audioRef.current = null;
    };
  }, [url]);

  // Web Audio graph for live frequency waves: source -> analyser ->
  // destination, built once per audio URL.
  useEffect(() => {
    if (!url || !audioRef.current || analyserRef.current) return;
    try {
      const Ctx = window.AudioContext;
      if (!Ctx) return;
      const ctx = new Ctx();
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 64;
      const source = ctx.createMediaElementSource(audioRef.current);
      source.connect(analyser);
      analyser.connect(ctx.destination);
      analyserRef.current = { ctx, analyser };
    } catch {
      analyserRef.current = null;
    }
    return () => {
      analyserRef.current?.ctx.close().catch(() => undefined);
      analyserRef.current = null;
    };
  }, [url]);

  // Simulated clock for demo cards without audio bytes.
  useEffect(() => {
    if (!current || url) return;
    if (!isPlaying) {
      stopSimulated();
      return;
    }
    timerRef.current = window.setInterval(() => {
      setCurrentTime((t) => {
        const next = t + 0.25;
        if (next >= duration) {
          setIsPlaying(false);
          stopSimulated();
          return duration;
        }
        return next;
      });
    }, 250);
    return stopSimulated;
  }, [current, url, isPlaying, duration, stopSimulated]);

  useEffect(() => stopSimulated, [stopSimulated]);
  useEffect(() => stopWaves, [stopWaves]);

  const play = useCallback(
    (card: Card) => {
      stopSimulated();
      audioRef.current?.pause();
      setCurrent(card);
      setCurrentTime(0);
      setDuration(Math.max(12, segmentsMax(card)));
      setIsPlaying(true);
      setOpen(true);
      // Heard loop: record the play, fire-and-forget.
      void fetch("/api/plays", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ cardId: card.id, memberId: viewer.id }),
      }).catch(() => undefined);
    },
    [stopSimulated, viewer.id],
  );

  const toggle = useCallback(() => {
    if (!current) return;
    if (audioRef.current && url) {
      if (isPlaying) {
        audioRef.current.pause();
        setIsPlaying(false);
      } else {
        void audioRef.current.play().then(
          () => setIsPlaying(true),
          () => setIsPlaying(false),
        );
      }
      return;
    }
    if (isPlaying) {
      setIsPlaying(false);
      return;
    }
    if (currentTime >= duration) setCurrentTime(0);
    setIsPlaying(true);
  }, [current, url, isPlaying, currentTime, duration]);

  const seek = useCallback(
    (seconds: number) => {
      const v = Math.max(0, Math.min(duration, seconds));
      if (audioRef.current && url) audioRef.current.currentTime = v;
      setCurrentTime(v);
    },
    [duration, url],
  );

  const expand = useCallback(() => setOpen(true), []);
  const collapse = useCallback(() => setOpen(false), []);
  const closePlayer = useCallback(() => {
    audioRef.current?.pause();
    stopSimulated();
    stopWaves();
    setIsPlaying(false);
    setCurrent(null);
    setOpen(false);
  }, [stopSimulated, stopWaves]);

  // Drive real-audio playback from isPlaying (set by play()).
  useEffect(() => {
    if (!audioRef.current || !url || !current) return;
    if (isPlaying && audioRef.current.paused) {
      void audioRef.current.play().catch(() => setIsPlaying(false));
    }
  }, [isPlaying, url, current]);

  const value = useMemo<PlayerState>(
    () => ({
      current,
      open,
      isPlaying,
      currentTime,
      duration,
      play,
      toggle,
      seek,
      expand,
      collapse,
      closePlayer,
    }),
    [current, open, isPlaying, currentTime, duration, play, toggle, seek, expand, collapse, closePlayer],
  );

  return (
    <PlayerContext.Provider value={value}>
      {children}
      <MiniPlayer />
      <FullPlayer analyserRef={analyserRef} />
    </PlayerContext.Provider>
  );
}

// The waveform IS the scrubber: played bars in warm amber, the rest dim.
// Pointer down/drag seeks. Live analyser waves when real audio plays.
function WaveScrubber({
  card,
  analyserRef,
}: {
  card: Card;
  analyserRef: React.MutableRefObject<{ ctx: AudioContext; analyser: AnalyserNode } | null>;
}) {
  const { currentTime, duration, seek, isPlaying } = usePlayer();
  const { displayLang } = useViewer();
  const url = resolveMediaUrl(card.mediaRef);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [live, setLive] = useState(false);
  const dragRef = useRef(false);

  const peaks = useMemo(() => {
    const p = card.peaks.length >= 24 ? card.peaks : new Array(48).fill(0.4);
    return p.slice(0, 48);
  }, [card.peaks]);

  // Live waves from the AnalyserNode while real audio plays.
  useEffect(() => {
    const canvas = canvasRef.current;
    const entry = analyserRef.current;
    if (!canvas || !url || !isPlaying || !entry) {
      setLive(false);
      return;
    }
    setLive(true);
    const { ctx, analyser } = entry;
    if (ctx.state === "suspended") void ctx.resume().catch(() => undefined);
    let raf = 0;
    const draw = () => {
      const data = new Uint8Array(analyser.frequencyBinCount);
      analyser.getByteFrequencyData(data);
      const g = canvas.getContext("2d");
      if (g) {
        const w = canvas.width;
        const h = canvas.height;
        g.clearRect(0, 0, w, h);
        const n = 48;
        const bw = w / n;
        for (let i = 0; i < n; i++) {
          const v = data[Math.floor((i / n) * data.length)] / 255;
          const bh = Math.max(3, v * h);
          const played = (i / n) * duration <= currentTime;
          g.fillStyle = played ? "#ffffff" : "rgba(255,255,255,0.36)";
          g.fillRect(i * bw + 1, (h - bh) / 2, Math.max(1, bw - 2), bh);
        }
      }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [url, isPlaying, analyserRef, duration, currentTime]);

  const ratioToTime = (clientX: number, el: HTMLElement) => {
    const rect = el.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / Math.max(1, rect.width)));
    return ratio * duration;
  };

  const progress = duration > 0 ? Math.max(0, Math.min(1, currentTime / duration)) : 0;

  return (
    <div>
      <div
        role="slider"
        aria-label="Seek"
        aria-valuemin={0}
        aria-valuemax={Math.round(duration)}
        aria-valuenow={Math.round(currentTime)}
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "ArrowRight") seek(currentTime + 2);
          if (e.key === "ArrowLeft") seek(currentTime - 2);
        }}
        onPointerDown={(e) => {
          dragRef.current = true;
          (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
          seek(ratioToTime(e.clientX, e.currentTarget));
        }}
        onPointerMove={(e) => {
          if (dragRef.current) seek(ratioToTime(e.clientX, e.currentTarget));
        }}
        onPointerUp={() => {
          dragRef.current = false;
        }}
        className="flex h-14 w-full cursor-pointer touch-none items-center"
      >
        {live ? (
          <canvas ref={canvasRef} width={480} height={56} className="h-14 w-full" aria-hidden="true" />
        ) : (
          <div className="flex h-14 w-full items-center gap-[2.5px]" aria-hidden="true">
            {peaks.map((p, i) => {
              const played = i / peaks.length <= progress;
              return (
                <span
                  key={i}
                  className="min-w-[2px] max-w-[4px] flex-1 rounded-full"
                  style={{
                    height: `${Math.max(6, Math.round(Number(p) * 50))}px`,
                    background: played ? "#ffffff" : "rgba(255,255,255,0.36)",
                  }}
                />
              );
            })}
          </div>
        )}
      </div>
      <div className="mt-1 flex justify-between text-[12px] tabular-nums text-white/60" aria-hidden="true">
        <span>{formatDuration(currentTime)}</span>
        <span>-{formatDuration(Math.max(0, duration - currentTime))}</span>
      </div>
      <span className="sr-only">
        {displayLang === "en" ? "Audio progress" : "progress"}
      </span>
    </div>
  );
}

function MiniPlayer() {
  const { current, open, isPlaying, toggle, expand, closePlayer, currentTime, duration } = usePlayer();
  const { displayLang, members } = useViewer();
  const { text } = useDisplayText(current?.caption ?? "", current?.lang, displayLang);
  if (!current || open) return null;
  const author = members.find((m) => m.id === current.authorId);
  return (
    <div
      className="fixed inset-x-0 z-40 flex justify-center px-3"
      style={{ bottom: "calc(12px + env(safe-area-inset-bottom))" }}
      role="region"
      aria-label="Now playing"
    >
      <div className="frost relative flex w-full max-w-[460px] items-center gap-3 overflow-hidden rounded-[22px] p-2 pr-2">
        <button type="button" onClick={expand} className="press flex min-w-0 flex-1 items-center gap-3 text-left" aria-label="Open player">
          <span className="relative h-12 w-12 shrink-0 overflow-hidden rounded-[14px] bg-surface">
            <Photo src={cardCover(current, members)} alt="" sizes="96px" />
          </span>
          <span className="min-w-0">
            <span className="block truncate text-[15px] font-semibold">{callName(author)}</span>
            <span className="block truncate text-[13px] text-ink-soft">{text ?? "…"}</span>
          </span>
        </button>
        <PlayButton playing={isPlaying} onClick={toggle} size={44} tone="dark" label={isPlaying ? "Pause" : "Play"} />
        <button type="button" onClick={closePlayer} aria-label="Stop and close" className="press grid h-11 w-11 place-items-center rounded-full text-ink-soft">
          <Icon name="close" size={20} />
        </button>
        <span className="absolute inset-x-4 bottom-0 h-[2px] rounded-full bg-black/5" aria-hidden="true">
          <span className="block h-full rounded-full bg-marigold" style={{ width: `${duration > 0 ? (currentTime / duration) * 100 : 0}%` }} />
        </span>
      </div>
    </div>
  );
}

function SyncedLyrics({ card, duration, currentTime }: { card: Card; duration: number; currentTime: number }) {
  const { displayLang } = useViewer();
  const source = card.transcript || card.caption;
  const sourceLang = card.transcript ? card.transcriptLang : card.lang;
  const { text: translated, translated: wasTranslated } = useDisplayText(source, sourceLang, displayLang);

  const lines = useMemo(() => {
    if (!wasTranslated && card.segments.length > 0 && card.transcript) return card.segments;
    if (translated === null) return null;
    return estimateSegments(translated, duration);
  }, [wasTranslated, card.segments, card.transcript, translated, duration]);

  if (lines === null) {
    return (
      <div aria-busy="true" aria-label="Loading words">
        <div className="mb-3 h-7 w-4/5 rounded-lg bg-white/15" />
        <div className="h-5 w-1/2 rounded-lg bg-white/10" />
      </div>
    );
  }
  let active = 0;
  lines.forEach((l, i) => {
    if (currentTime >= l.start) active = i;
  });
  return (
    <ol className="m-0 list-none p-0" aria-live="polite">
      {lines.map((l, i) =>
        i < active - 1 ? null : (
          <li
            key={i}
            aria-current={i === active ? "true" : undefined}
            className={
              i === active
                ? "voice mb-3 text-[26px] leading-[1.25] text-white transition-all"
                : "mb-3 text-[17px] leading-snug text-white/45 transition-all"
            }
          >
            {l.text}
          </li>
        ),
      )}
    </ol>
  );
}

// Full-screen Now Playing: the photo becomes the room. Blurred art fills the
// screen, the waveform is the scrubber, and the words arrive like lyrics.
function FullPlayer({
  analyserRef,
}: {
  analyserRef: React.MutableRefObject<{ ctx: AudioContext; analyser: AnalyserNode } | null>;
}) {
  const { current, open, isPlaying, currentTime, duration, toggle, collapse } = usePlayer();
  const { displayLang, members } = useViewer();
  const { openAdd } = useShell();
  const { translated } = useDisplayText(current?.caption ?? "", current?.lang, displayLang);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") collapse();
      if (e.key === " ") {
        e.preventDefault();
        toggle();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, collapse, toggle]);

  const author = current ? members.find((m) => m.id === current.authorId) : undefined;
  const art = current ? cardCover(current, members) : "";

  return (
    <AnimatePresence>
      {open && current && (
        <motion.div
          role="dialog"
          aria-modal="true"
          aria-label={`Voice note from ${callName(author)}`}
          className="fixed inset-0 z-50 overflow-hidden bg-[var(--player-ground)] text-white"
          initial={{ y: "100%" }}
          animate={{ y: 0 }}
          exit={{ y: "100%" }}
          transition={{ type: "spring", stiffness: 300, damping: 34 }}
          drag="y"
          dragConstraints={{ top: 0, bottom: 0 }}
          dragElastic={{ top: 0, bottom: 0.6 }}
          onDragEnd={(_, info) => {
            if (info.offset.y > 140 || info.velocity.y > 600) collapse();
          }}
        >
          <div className="absolute inset-[-60px] scale-110" aria-hidden="true" style={{ filter: "blur(60px) saturate(1.4) brightness(.62)" }}>
            <Photo src={art} alt="" sizes="200px" />
          </div>
          <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-transparent to-black/45" aria-hidden="true" />
          <div
            className="relative mx-auto flex h-full w-full max-w-[480px] flex-col px-6"
            style={{ paddingTop: "calc(14px + env(safe-area-inset-top))", paddingBottom: "calc(24px + env(safe-area-inset-bottom))" }}
          >
            <div className="flex items-center justify-between">
              <button type="button" onClick={collapse} aria-label="Minimise player" className="press -ml-2 grid h-11 w-11 place-items-center rounded-full">
                <Icon name="down" size={26} />
              </button>
              <span className="mx-auto block h-1.5 w-10 rounded-full bg-white/35" aria-hidden="true" />
              <span className="w-11" aria-hidden="true" />
            </div>

            <div className="relative mx-auto mt-4 aspect-square w-full max-w-[340px] overflow-hidden rounded-[28px]" style={{ boxShadow: "0 30px 60px rgba(0,0,0,.45)" }}>
              <Photo src={art} alt={`${callName(author)}`} sizes="680px" priority position="center 30%" />
            </div>

            <div className="mt-6 flex items-end justify-between gap-3">
              <div className="min-w-0">
                <p className="m-0 truncate text-[24px] font-bold leading-tight">{callName(author)}</p>
                <p className="m-0 mt-0.5 text-[15px] text-white/65">{translated ? "Translated for you" : "Voice note"}</p>
              </div>
              <PlayButton playing={isPlaying} onClick={toggle} size={60} label={isPlaying ? "Pause" : "Play"} />
            </div>

            <div className="mt-4">
              <WaveScrubber card={current} analyserRef={analyserRef} />
            </div>

            <div className="no-scrollbar mt-4 min-h-0 flex-1 overflow-y-auto">
              <SyncedLyrics card={current} duration={duration} currentTime={currentTime} />
            </div>

            <ReactionBar
              cardId={current.id}
              tone="glass"
              onReply={() => {
                collapse();
                openAdd("voice", null, current.authorId);
              }}
            />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
